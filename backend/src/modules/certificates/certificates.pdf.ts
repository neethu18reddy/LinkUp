import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import { AppError } from '../../utils/AppError.js';
import type { CertificateView } from './certificates.repository.js';

const require = createRequire(import.meta.url);
const subsets = [
  'latin',
  'latin-ext',
  'cyrillic',
  'cyrillic-ext',
  'greek',
  'greek-ext',
  'vietnamese',
];
export async function certificatePdf(certificate: CertificateView) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = await Promise.all(
    subsets.map(async (subset) =>
      doc.embedFont(
        await readFile(
          require.resolve(`@fontsource/noto-sans/files/noto-sans-${subset}-400-normal.woff`),
        ),
        { subset: true },
      ),
    ),
  );
  const supported = fonts.map((font) => new Set(font.getCharacterSet()));
  const page = doc.addPage([842, 595]);
  const green = rgb(0.12, 0.3, 0.23);
  page.drawRectangle({ x: 24, y: 24, width: 794, height: 547, borderColor: green, borderWidth: 1 });
  function text(value: string, y: number, initialSize: number, maxWidth = 720) {
    const characters = Array.from(value.replace(/[\r\n\t]/g, ' '));
    const runs: { text: string; index: number }[] = [];
    for (const character of characters) {
      const index = supported.findIndex((set) => set.has(character.codePointAt(0)!));
      if (index < 0)
        throw new AppError(
          422,
          'PDF_FONT_UNSUPPORTED',
          'This name or role uses a script not yet supported by the PDF font. Your full name remains available on the verification page.',
        );
      const last = runs.at(-1);
      if (last?.index === index) last.text += character;
      else runs.push({ text: character, index });
    }
    const width = (size: number) =>
      runs.reduce((sum, run) => sum + fonts[run.index]!.widthOfTextAtSize(run.text, size), 0);
    const size = Math.min(initialSize, (initialSize * maxWidth) / Math.max(1, width(initialSize)));
    let x = (842 - width(size)) / 2;
    for (const run of runs) {
      const font = fonts[run.index]!;
      page.drawText(run.text, { x, y, size, font, color: green });
      x += font.widthOfTextAtSize(run.text, size);
    }
  }
  text('linkup', 525, 22);
  text('Certificate of completion', 456, 32);
  text('This recognizes', 414, 13);
  text(certificate.recipientName, 365, 30);
  text('for completing the learning roadmap for', 328, 13);
  text(certificate.roleTitle, 288, 24);
  text(
    `${certificate.completedHours} planned learning hours | Issued ${certificate.issuedAt.slice(0, 10)} (UTC)`,
    248,
    12,
  );
  text(
    'Completion and project evidence are learner-reported, not an accredited qualification.',
    218,
    10,
  );
  const qr = await doc.embedPng(
    await QRCode.toBuffer(certificate.verificationUrl, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 4,
      width: 300,
    }),
  );
  page.drawImage(qr, { x: 369, y: 95, width: 104, height: 104 });
  text(`Certificate ID: ${certificate.id}`, 79, 10);
  text(certificate.verificationUrl, 58, 9, 740);
  text(
    'Scan to check current validity. Reopened coursework makes this certificate inactive.',
    39,
    8,
  );
  doc.setTitle('linkup certificate of completion');
  doc.setAuthor('linkup');
  doc.setCreationDate(new Date(certificate.issuedAt));
  doc.setModificationDate(new Date(certificate.issuedAt));
  return Buffer.from(await doc.save());
}
