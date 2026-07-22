import { parentPort, workerData } from 'node:worker_threads'
import { parseAndInspectPdf } from './pdfInspect.js'

async function main() {
  try {
    const buffer = Buffer.isBuffer(workerData?.buffer)
      ? workerData.buffer
      : Buffer.from(workerData?.buffer || [])
    await parseAndInspectPdf(buffer)
    parentPort.postMessage({ ok: true })
  } catch (error) {
    parentPort.postMessage({
      ok: false,
      status: error?.status || 415,
      code: error?.code || 'INVALID_PDF',
      message: error?.message || 'PDF could not be parsed',
    })
  }
}

main()
