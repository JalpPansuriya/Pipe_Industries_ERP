import React, { useEffect, useState, useRef } from 'react';
import { X, Printer, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useAuth } from '../context/AuthContext';
import { getInvoice, getCompanySettings } from '../services/firestoreService';
import { formatCurrency, formatDate } from '../lib/utils';

interface InvoicePrintModalProps {
  invoiceId: string;
  onClose: () => void;
  autoDownload?: boolean;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({ invoiceId, onClose, autoDownload = false }) => {
  const { token } = useAuth();
  const [invoice, setInvoice] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [invoiceData, settingsData] = await Promise.all([
          getInvoice(invoiceId),
          getCompanySettings()
        ]);
        setInvoice(invoiceData);
        setSettings(settingsData);
      } catch (e: any) {
        console.error(e);
        setError(e.message || 'Failed to load invoice data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [invoiceId]);

  const handlePrint = () => {
    const printContent = document.getElementById('printable-invoice');
    if (!printContent) return;

    // Create a hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    // Get all styles from the current document to ensure the invoice looks the same
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(style => style.outerHTML)
      .join('\n');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Invoice - ${invoice.invoice_no}</title>
          ${styles}
          <style>
            @page { 
              size: A5 landscape; 
              margin: 0; 
            }
            body { 
              margin: 0; 
              padding: 0;
              background: white;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #printable-invoice {
              width: 210mm !important;
              height: 148mm !important;
              padding: 10mm !important;
              margin: 0 !important;
              border: none !important;
              box-sizing: border-box;
              display: block !important;
              visibility: visible !important;
            }
            /* Force visibility for all elements inside the invoice */
            #printable-invoice * {
              visibility: visible !important;
            }
          </style>
        </head>
        <body>
          <div id="printable-invoice">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.focus();
                window.print();
                setTimeout(() => {
                  window.parent.document.body.removeChild(window.frameElement);
                }, 500);
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('printable-invoice');
    if (!element) return;

    setIsDownloading(true);
    window.scrollTo(0, 0);
    try {
      const canvas = await html2canvas(element, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a5',
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice_${invoice.invoice_no}.pdf`);
      return true;
    } catch (error) {
      console.error('Error generating PDF:', error);
      return false;
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    if (invoice && autoDownload && !loading && !isDownloading) {
      // Small delay to ensure DOM is ready for html2canvas
      const timer = setTimeout(async () => {
        const success = await handleDownloadPDF();
        if (success) {
          onClose();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [invoice, autoDownload, loading]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white p-6 rounded-xl shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[#141414] border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold text-[#141414]">
              {autoDownload ? 'Preparing your download...' : 'Loading invoice...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white p-6 rounded-xl shadow-2xl max-w-md w-full">
          <h3 className="text-lg font-bold text-red-600 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={onClose}
            className="w-full py-2 bg-[#141414] text-white rounded-lg font-bold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  const numberToWords = (num: any): string => {
    const n_num = Number(num);
    if (isNaN(n_num)) return 'Zero';
    if (n_num === 0) return 'Zero';
    
    const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];

    const numStr = Math.floor(n_num).toString();
    if (numStr.length > 9) return 'overflow';
    const n = ('000000000' + numStr).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return ''; 
    let str = '';
    str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
    str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
    str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
    str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
    str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) + 'Only' : 'Only';
    return str.trim() || 'Zero';
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:p-0 print:bg-white print:block overflow-y-auto">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { 
            size: A5 landscape; 
            margin: 0; 
          }
          body * {
            visibility: hidden;
          }
          #printable-invoice, #printable-invoice * {
            visibility: visible !important;
          }
          #printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm !important;
            height: 148mm !important;
            padding: 10mm !important;
            margin: 0 !important;
            border: none !important;
            -webkit-print-color-adjust: exact;
            visibility: visible !important;
          }
        }
      `}} />
      <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:rounded-none">
        
        {/* Modal Header - Hidden when printing */}
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex justify-between items-center z-10 print:hidden">
          <h3 className="text-lg font-bold">Print Invoice</h3>
          <div className="flex gap-2">
            <button 
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-[#141414] rounded-lg hover:bg-gray-50 transition-colors text-sm font-bold uppercase tracking-widest disabled:opacity-50"
            >
              <Download size={16} className={isDownloading ? "animate-bounce" : ""} />
              {isDownloading ? 'Generating...' : 'Download'}
            </button>
            <button 
              onClick={handlePrint}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 bg-[#141414] text-white rounded-lg hover:bg-black transition-colors text-sm font-bold uppercase tracking-widest disabled:opacity-50"
            >
              <Printer size={16} />
              Print
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Invoice Content - This is what gets printed */}
        <div className="p-8 print:p-0 text-black font-sans mx-auto" id="printable-invoice" style={{ width: '210mm', minHeight: '148mm' }}>
          <div className="border-2 border-black h-full flex flex-col box-border">
            
            {/* Main Header */}
            <div className="text-center border-b-2 border-black py-2 bg-gray-50/50">
              <h1 className="text-2xl font-extrabold tracking-[0.15em] mb-0.5 uppercase italic serif">{settings?.companyName || 'SAMRAT PIPE INDUSTRIES'}</h1>
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest leading-tight px-12">
                {settings?.address || 'Junagadh, Gujarat, India'}
              </p>
            </div>

            {/* GSTIN/State/PAN Line */}
            <div className="grid grid-cols-[33%_34%_33%] border-b-2 border-black text-[10px] font-bold px-2 py-0.5 whitespace-nowrap overflow-hidden">
              <div>GSTIN No. : {settings?.gstin || '____________________'}</div>
              <div className="text-center">State : {settings?.state || 'Gujarat'} &nbsp;&nbsp;&nbsp; State Code : {settings?.stateCode || '24'}</div>
              <div className="text-right">PAN No. : {settings?.pan || '____________________'}</div>
            </div>

            {/* Title Bar: Debit Memo | Tax Invoice | ORIGINAL */}
            <div className="grid grid-cols-[25%_50%_25%] border-b-2 border-black text-xs font-bold leading-none">
              <div className="border-r-2 border-black px-2 py-1.5 h-full flex items-center">Debit Memo</div>
              <div className="border-r-2 border-black px-2 py-1.5 h-full flex items-center justify-center text-sm uppercase tracking-widest">Tax Invoice</div>
              <div className="px-2 py-1.5 h-full flex items-center justify-end">ORIGINAL</div>
            </div>

            {/* Customer & Invoice Details */}
            <div className="grid grid-cols-[55%_45%] border-b-2 border-black text-[11px]">
              <div className="border-r-2 border-black p-2 flex flex-col min-h-[100px]">
                <div className="flex gap-2">
                  <span className="font-extrabold shrink-0">M/s.</span>
                  <div className="font-extrabold uppercase leading-tight">
                    <div className="text-sm">{invoice.dealer_name}</div>
                    <div className="whitespace-pre-wrap">{invoice.dealer_address || ''}</div>
                  </div>
                </div>
                <div className="mt-auto space-y-0.5 font-bold">
                  <div>GSTIN No. : {invoice.dealer_gstin || '____________________'}</div>
                  <div>Place of Supply : {invoice.place_of_supply || '24 - Gujarat'}</div>
                  <div>PAN No. : ____________________</div>
                </div>
              </div>
              <div className="p-2 flex flex-col font-bold">
                <div className="flex justify-between mb-1">
                  <span>Invoice No. :</span>
                  <span className="text-sm">{invoice.invoice_no}</span>
                </div>
                <div className="flex justify-between mb-4">
                  <span>Invoice Date :</span>
                  <span>{formatDate(invoice.date)}</span>
                </div>
              </div>
            </div>

            {/* Items Table Header */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="border-b-2 border-black font-extrabold uppercase">
                    <th className="border-r-2 border-black w-10 py-1 text-center">Sr.</th>
                    <th className="border-r-2 border-black px-2 py-1 text-left">Particular</th>
                    <th className="border-r-2 border-black w-24 py-1 text-center">HSNCode</th>
                    <th className="border-r-2 border-black w-20 py-1 text-center">Quantity</th>
                    <th className="border-r-2 border-black w-12 py-1 text-center">Unit</th>
                    <th className="border-r-2 border-black w-24 py-1 text-right pr-2">Rate</th>
                    <th className="w-32 py-1 text-right pr-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="relative min-h-[300px]">
                  {invoice.items.map((item: any, index: number) => {
                    const qty = Number(item.qty) || 0;
                    const rate = Number(item.rate) || 0;
                    const amount = (qty * rate).toFixed(2);
                    return (
                      <tr key={index} className="font-bold border-b border-gray-100">
                        <td className="border-r-2 border-black text-center py-1">{index + 1}</td>
                        <td className="border-r-2 border-black px-2 py-1 uppercase">{item.product_name}</td>
                        <td className="border-r-2 border-black text-center py-1">{item.hsn_code || ''}</td>
                        <td className="border-r-2 border-black text-right pr-2 py-1">{qty.toFixed(3)}</td>
                        <td className="border-r-2 border-black text-center py-1">{item.unit || ''}</td>
                        <td className="border-r-2 border-black text-right pr-2 py-1">{rate.toFixed(2)}</td>
                        <td className="text-right pr-2 py-1">{amount}</td>
                      </tr>
                    );
                  })}
                  {/* Fill blank rows to exactly reach fixed height */}
                  {Array.from({ length: Math.max(0, 16 - invoice.items.length) }).map((_, i) => (
                    <tr key={`fill-${i}`}>
                      <td className="border-r-2 border-black h-5"></td>
                      <td className="border-r-2 border-black px-2 h-5"></td>
                      <td className="border-r-2 border-black text-center h-5"></td>
                      <td className="border-r-2 border-black text-right pr-2 h-5"></td>
                      <td className="border-r-2 border-black text-center h-5"></td>
                      <td className="border-r-2 border-black text-right pr-2 h-5"></td>
                      <td className="h-5"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Section */}
            <div className="border-t-2 border-black">
              <div className="grid grid-cols-[1fr_210px_128px]">
                <div className="bg-white border-r-2 border-black p-2 flex items-center">
                  <span className="text-[10px] font-bold italic opacity-60">Verified Tax Invoice</span>
                </div>
                <div className="flex flex-col font-extrabold uppercase text-[10px]">
                  <div className="border-r-2 border-black border-b flex-1 flex items-center justify-end pr-4 py-1">Sub Total</div>
                  <div className="border-r-2 border-black border-b flex-1 flex items-center justify-end pr-4 py-1">Output CGST ({(invoice.items[0]?.gst_rate / 2).toFixed(1)}%)</div>
                  <div className="border-r-2 border-black border-b flex-1 flex items-center justify-end pr-4 py-1">Output SGST ({(invoice.items[0]?.gst_rate / 2).toFixed(1)}%)</div>
                  <div className="border-r-2 border-black flex-1 flex items-center justify-end pr-4 py-1 bg-gray-50">Grand Total</div>
                </div>
                <div className="flex flex-col font-extrabold text-[10px] text-right">
                  <div className="border-b flex-1 flex items-center justify-end pr-2 py-1">{(Number(invoice.total) - Number(invoice.gst)).toFixed(2)}</div>
                  <div className="border-b flex-1 flex items-center justify-end pr-2 py-1">{(Number(invoice.gst) / 2).toFixed(2)}</div>
                  <div className="border-b flex-1 flex items-center justify-end pr-2 py-1">{(Number(invoice.gst) / 2).toFixed(2)}</div>
                  <div className="flex-1 flex items-center justify-end pr-2 py-1 bg-gray-50">{Number(invoice.total).toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Amount In Words */}
            <div className="border-y-2 border-black px-2 py-1 text-[11px] font-bold">
              <span className="uppercase">Rs. In Words : </span>
              <span className="capitalize">{numberToWords(Math.round(invoice.total))} Only</span>
            </div>

            {/* Signature & T&C */}
            <div className="grid grid-cols-3 text-[11px] p-2 min-h-[80px]">
              <div>
                <div className="font-extrabold underline mb-1">Terms & Conditions</div>
                <div className="font-bold text-[9px] leading-tight max-w-[200px]">
                  {settings?.terms || 'Subject to JUNAGADH jurisdiction.'}
                </div>
              </div>
              <div className="flex items-end justify-center font-extrabold pb-2">
                E. & O. E.
              </div>
              <div className="flex flex-col justify-between items-end">
                <div className="font-extrabold text-[10px]">For, {settings?.companyName || 'SAMRAT PIPE INDUSTRIES'}</div>
                <div className="font-extrabold uppercase border-t border-black pt-1 w-full text-center mt-auto text-[10px]">Authorised Signatory</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
