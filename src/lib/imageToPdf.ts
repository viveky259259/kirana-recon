// Wrap a JPEG image into a single-page PDF — no dependencies.
//
// Sarvam's document-intelligence API only accepts a PDF (or ZIP) as input, but
// the merchant captures a *photo* of the paper note. JPEG bytes can be embedded
// directly in a PDF image XObject via the /DCTDecode filter (a JPEG *is* a DCT
// stream), so we can build the PDF by hand without re-encoding the pixels.

// Read intrinsic pixel dimensions from a JPEG's Start-Of-Frame marker.
function jpegSize(buf: Buffer): { width: number; height: number } {
  let i = 2; // skip SOI (0xFFD8)
  while (i < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    // SOF0..SOF15 carry dimensions, except DHT(C4), JPG(C8), DAC(CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      return { width, height };
    }
    i += 2 + buf.readUInt16BE(i + 2); // jump past this segment
  }
  throw new Error("Not a valid JPEG (no SOF marker found)");
}

export function jpegToPdf(jpeg: Buffer): Buffer {
  const { width, height } = jpegSize(jpeg);

  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
        `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
    ),
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
          `/Length ${jpeg.length} >>\nstream\n`
      ),
      jpeg,
      Buffer.from("\nendstream"),
    ]),
  ];
  const content = Buffer.from(`q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`);
  objects.push(
    Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from("\nendstream")])
  );

  let pdf = Buffer.from("%PDF-1.4\n");
  const offsets: number[] = [];
  objects.forEach((obj, idx) => {
    offsets.push(pdf.length);
    pdf = Buffer.concat([pdf, Buffer.from(`${idx + 1} 0 obj\n`), obj, Buffer.from("\nendobj\n")]);
  });

  const xrefStart = pdf.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += String(off).padStart(10, "0") + " 00000 n \n";
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.concat([pdf, Buffer.from(xref)]);
}
