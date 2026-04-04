import React, { useEffect, useState } from 'react';
import { X, Printer, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { formatCurrency, formatDate } from '../lib/utils';

interface InvoicePrintModalProps {
  invoiceId: number;
  onClose: () => void;
  autoDownload?: boolean;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({ invoiceId, onClose, autoDownload = false }) => {
  const { token } = useAuth();
  const { fetchWithAuth } = useApi();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const data = await fetchWithAuth(`/api/invoices/${invoiceId}`);
        setInvoice(data);
      } catch (e: any) {
        console.error(e);
        setError(e.message || 'Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [invoiceId, token]);

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
          <div className="border-2 border-black p-4 h-full flex flex-col">
            
            {/* Header */}
            <div className="text-center mb-4 border-b-2 border-black pb-4">
              <h1 className="text-3xl font-bold tracking-wider">ESTIMATE</h1>
            </div>

            <div className="flex justify-between text-sm font-bold mb-2">
              <div>GSTIN No. : </div>
              <div>State : Gujarat &nbsp;&nbsp;&nbsp; State Code : 24</div>
              <div>PAN No. : </div>
            </div>

            {/* Invoice Details Grid */}
            <div className="flex border-y-2 border-black">
              <div className="w-1/3 border-r-2 border-black p-2 font-bold">
                Debit Memo
              </div>
              <div className="w-1/3 border-r-2 border-black p-2 font-bold text-lg text-center">
                Tax Invoice
              </div>
              <div className="w-1/3 p-2 font-bold text-right">
                ORIGINAL
              </div>
            </div>

            <div className="grid grid-cols-[60%_40%] border-b-2 border-black">
              <div className="border-r-2 border-black p-2 flex flex-col justify-between">
                <div className="flex gap-2 mb-1">
                  <span className="font-bold">M/s.</span>
                  <div className="font-bold">
                    <div>{invoice.dealer_name}</div>
                    <div>{invoice.dealer_address || 'SURENDRANAGAR'}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <span className="font-bold">GSTIN : </span> {invoice.dealer_gstin || ''}
                </div>
              </div>
              <div className="p-2 flex flex-col">
                <div className="flex gap-4 mb-1">
                  <span className="font-bold w-24">Invoice No.</span>
                  <span className="font-bold">: {invoice.invoice_no}</span>
                </div>
                <div className="flex gap-4 mb-4">
                  <span className="font-bold w-24">Invoice Date</span>
                  <span className="font-bold">: {formatDate(invoice.date)}</span>
                </div>
                <div className="mt-auto">
                  <span className="font-bold">Place of Supply</span> 24 - Gujarat
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="flex-1">
              <table className="w-full text-sm border-b-2 border-black">
                <thead>
                  <tr className="border-b-2 border-black">
                    <th className="border-r-2 border-black p-1 text-center w-12">Sr.</th>
                    <th className="border-r-2 border-black p-1 text-left">Particular</th>
                    <th className="border-r-2 border-black p-1 text-center w-24">HSNCode</th>
                    <th className="border-r-2 border-black p-1 text-right w-24">Quantity</th>
                    <th className="border-r-2 border-black p-1 text-center w-16">Unit</th>
                    <th className="border-r-2 border-black p-1 text-right w-32">Rate</th>
                    <th className="p-1 text-right w-32">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item: any, index: number) => {
                    const qty = Number(item.qty) || 0;
                    const rate = Number(item.rate) || 0;
                    const amount = qty * rate;
                    return (
                      <tr key={index}>
                        <td className="border-r-2 border-black p-1 text-center">{index + 1}</td>
                        <td className="border-r-2 border-black p-1">{item.product_name}</td>
                        <td className="border-r-2 border-black p-1 text-center">{item.hsn_code || ''}</td>
                        <td className="border-r-2 border-black p-1 text-right">{qty.toFixed(3)}</td>
                        <td className="border-r-2 border-black p-1 text-center"></td>
                        <td className="border-r-2 border-black p-1 text-right">{rate.toFixed(2)}</td>
                        <td className="p-1 text-right">{amount.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  {/* Empty rows to fill space if needed */}
                  {Array.from({ length: Math.max(0, 5 - invoice.items.length) }).map((_, i) => (
                    <tr key={`empty-${i}`}>
                      <td className="border-r-2 border-black p-1">&nbsp;</td>
                      <td className="border-r-2 border-black p-1"></td>
                      <td className="border-r-2 border-black p-1"></td>
                      <td className="border-r-2 border-black p-1"></td>
                      <td className="border-r-2 border-black p-1"></td>
                      <td className="border-r-2 border-black p-1"></td>
                      <td className="p-1"></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-black">
                    <td colSpan={5} className="border-r-2 border-black p-1"></td>
                    <td className="border-r-2 border-black p-1 font-bold text-right">Sub Total</td>
                    <td className="p-1 text-right font-bold">{invoice.total.toFixed(2)}</td>
                  </tr>
                  <tr className="border-t-2 border-black">
                    <td colSpan={5} className="border-r-2 border-black p-1 bg-gray-100 h-10"></td>
                    <td className="border-r-2 border-black p-1 font-bold">
                      <div className="flex justify-between">
                        <span>Grand Total</span>
                        <span>₹</span>
                      </div>
                    </td>
                    <td className="p-1 text-right font-bold">{invoice.total.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer */}
            <div className="border-b-2 border-black p-1">
              <span className="font-bold">Rs. In Words : </span>
              {numberToWords(Math.round(invoice.total))}
            </div>
            
            <div className="flex justify-between p-2 pt-4">
              <div>
                <div className="font-bold mb-1">Terms & Conditions</div>
                <div className="text-sm">Subject to JUNAGADH jurisdiction.</div>
              </div>
              <div className="text-center pt-8">
                <div className="font-bold mb-8">E. & O. E.</div>
              </div>
              <div className="text-right flex flex-col justify-between">
                <div className="font-bold">For, ESTIMATE</div>
                <div className="mt-12">Authorised Signatory</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
