import * as XLSX from 'xlsx';
import { stringifyCsv, withUtf8Bom, type CsvDelimiter } from './csv';

/**
 * Função pública para exportar um array de objetos para XLSX
 * @param data Array de objetos a serem exportados
 * @param filename Nome do arquivo (sem extensão)
 */
export function exportToXLSX(data: any[], filename: string) {
    if (!data || data.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Função pública para exportar um array de objetos para CSV no client-side
 * @param data Array de objetos a serem exportados
 * @param filename Nome do arquivo (sem extensão)
 * @param delimiter Delimitador do CSV
 */
export function exportToCSV(data: any[], filename: string, delimiter: CsvDelimiter = ';') {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(header => {
        const val = row[header];
        return val === null || val === undefined ? '' : String(val);
    }));

    const csvContent = withUtf8Bom(stringifyCsv([headers, ...rows], delimiter));

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
