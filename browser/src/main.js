import { signPdf } from './sign.js';

const form = document.getElementById('sign-form');
const statusEl = document.getElementById('status');
const downloadLink = document.getElementById('download');

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

async function readFileAsText(file) {
  return file.text();
}

async function readFileAsBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  downloadLink.style.display = 'none';
  if (downloadLink.href) {
    URL.revokeObjectURL(downloadLink.href);
    downloadLink.removeAttribute('href');
  }

  const pdfFile = document.getElementById('pdf').files[0];
  const keyFile = document.getElementById('key').files[0];
  const certFile = document.getElementById('cert').files[0];

  const reason = document.getElementById('reason').value;
  const location = document.getElementById('location').value;
  const name = document.getElementById('name').value;

  setStatus('Signing...');

  try {
    const [pdfBytes, privateKeyPem, certificatePem] = await Promise.all([
      readFileAsBytes(pdfFile),
      readFileAsText(keyFile),
      readFileAsText(certFile),
    ]);

    const signedPdf = await signPdf({
      pdfBytes,
      privateKeyPem,
      certificatePem,
      metadata: { reason, location, name },
    });

    const blob = new Blob([signedPdf], { type: 'application/pdf' });
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.style.display = 'inline-block';

    setStatus('PDF signed successfully.');
  } catch (err) {
    setStatus(`Error: ${err.message}`, true);
  }
});
