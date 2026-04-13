import fs from 'node:fs'
import XLSX from 'xlsx'
import config from './config.js'

export function loadWorkbookSheet(sheetName) {
  if (!fs.existsSync(config.outputExcel)) {
    return []
  }
  try {
    const workbook = XLSX.readFile(config.outputExcel)
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) return []
    return XLSX.utils.sheet_to_json(worksheet, { defval: null })
  } catch {
    return []
  }
}

export function writeWorkbook(datasets) {
  const workbook = XLSX.utils.book_new()
  Object.entries(datasets).forEach(([sheetName, rows]) => {
    const worksheet = XLSX.utils.json_to_sheet(rows && rows.length ? rows : [{}])
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  })
  XLSX.writeFile(workbook, config.outputExcel)
}