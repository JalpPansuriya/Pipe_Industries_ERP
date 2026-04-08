import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Plus, Search, FileText, MoreVertical, Edit2, Trash2, History, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { 
  getProducts, 
  getTransactions, 
  addProduct, 
  updateProduct, 
  deleteProduct, 
  adjustStock 
} from '../services/firestoreService';

export const Inventory: React.FC = () => {
  const { token, user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{message: string, onConfirm: () => void} | null>(null);
  const printRef = React.useRef<HTMLDivElement>(null);

  const fetchProducts = async () => {
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'An error occurred while fetching products');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (productId: string) => {
    try {
      const data = await getTransactions(productId);
      setTransactions(data);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'An error occurred while fetching transactions');
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [token]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    try {
      const productData = {
        sku: data.sku as string,
        name: data.name as string,
        category: data.category as string,
        unit: data.unit as string,
        hsn_code: data.hsn_code as string,
        price: parseFloat(data.price as string),
        stock_qty: parseInt(data.stock_qty as string, 10) || 0,
        low_stock_threshold: parseInt(data.low_stock_threshold as string, 10) || 10
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
      } else {
        await addProduct(productData);
      }
      
      setIsModalOpen(false);
      setEditingProduct(null);
      fetchProducts();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'An error occurred while saving the product');
    }
  };

  const handleDeleteProduct = (id: string) => {
    setConfirmAction({
      message: 'Are you sure you want to delete this product?',
      onConfirm: async () => {
        try {
          await deleteProduct(id);
          fetchProducts();
        } catch (e: any) {
          console.error(e);
          setErrorMsg(e.message || 'An error occurred while deleting the product');
        }
        setConfirmAction(null);
      }
    });
  };

  const handleExportPDF = async () => {
    if (products.length === 0 || !printRef.current) return;
    
    setIsExporting(true);
    // Wait for state update to show print template
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(printRef.current!, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Product_Catalogue_${new Date().toISOString().split('T')[0]}.pdf`);
      } catch (e) {
        console.error('PDF Export failed:', e);
        setErrorMsg('Failed to generate PDF');
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#141414]">Products</h2>
          <p className="text-gray-500 mt-1">Manage your product catalogue and pricing.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => handleExportPDF()}
            className="flex items-center gap-2 bg-white text-gray-600 px-4 py-2 rounded-lg font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Download size={18} />
            <span>Export PDF</span>
          </button>
          {user?.role === 'Admin' && (
            <button 
              onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
              className="flex items-center gap-2 bg-[#141414] text-white px-4 py-2 rounded-lg font-medium hover:bg-black transition-colors"
            >
              <Plus size={18} />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name or SKU..." 
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-16">S.No</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Code / SKU</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Product Name</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">HSN Code</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Price</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredProducts.map((product, index) => (
              <tr key={product.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-6 py-4 text-sm font-bold text-gray-400">{index + 1}</td>
                <td className="px-6 py-4 text-sm font-mono text-gray-500">{product.sku}</td>
                <td className="px-6 py-4 text-sm font-bold text-[#141414]">{product.name}</td>
                <td className="px-6 py-4 text-sm font-bold text-center text-gray-500">{product.hsn_code || '---'}</td>
                <td className="px-6 py-4 text-sm font-bold text-[#141414]">{formatCurrency(product.price)}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 transition-opacity">
                    <button 
                      onClick={() => {
                        setSelectedProduct(product);
                        fetchTransactions(product.id);
                        setIsHistoryModalOpen(true);
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Billing History"
                    >
                      <History size={18} />
                    </button>
                    {user?.role === 'Admin' && (
                      <>
                        <button 
                          onClick={() => { setEditingProduct(product); setIsModalOpen(true); }}
                          className="p-2 text-gray-400 hover:text-[#141414] hover:bg-gray-100 rounded-lg transition-all"
                          title="Edit Product"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete Product"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-2xl font-bold italic serif mb-6">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">SKU</label>
                  <input name="sku" defaultValue={editingProduct?.sku} required className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">HSN Code</label>
                  <input name="hsn_code" defaultValue={editingProduct?.hsn_code} className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Product Name</label>
                <input name="name" defaultValue={editingProduct?.name} required className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Unit</label>
                  <input name="unit" defaultValue={editingProduct?.unit || 'Nos'} placeholder="e.g. Nos, Mtr" className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Category</label>
                  <input name="category" defaultValue={editingProduct?.category || 'General'} className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Price (₹)</label>
                <input name="price" type="number" step="0.01" defaultValue={editingProduct?.price} required className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm" />
              </div>
              {!editingProduct && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Initial Stock</label>
                  <input name="stock_qty" type="number" min="0" defaultValue={0} className="w-full px-4 py-2 bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-[#141414] text-sm" />
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 text-sm font-bold uppercase tracking-widest text-gray-400 hover:text-[#141414] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget.closest('form');
                    if (form) {
                      if (form.checkValidity()) {
                        form.requestSubmit();
                      } else {
                        form.reportValidity();
                      }
                    }
                  }}
                  className="flex-1 bg-[#141414] text-white py-2 rounded-lg font-bold uppercase tracking-widest hover:bg-black transition-colors"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-[#141414]">Stock History</h3>
                <p className="text-sm text-gray-500">{selectedProduct.name} ({selectedProduct.sku})</p>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {transactions.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Date</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Type</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Quantity</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(tx.date)}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            tx.type === 'IN' ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          )}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-[#141414]">
                          {tx.type === 'IN' ? '+' : '-'}{tx.qty} {selectedProduct.unit}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {tx.reference_id ? `#${tx.reference_id}` : 'Manual Adjustment'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-gray-500 py-8">No transaction history found.</p>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Error Modal */}
      {errorMsg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-red-600 mb-4">Error</h3>
            <p className="text-gray-600 mb-6">{errorMsg}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setErrorMsg(null)}
                className="bg-[#141414] text-white px-4 py-2 rounded-lg font-medium hover:bg-black transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Template (Hidden) */}
      <div className="fixed -left-[2000px] top-0 shadow-none pointer-events-none">
        <div ref={printRef} className="p-12 w-[800px] bg-white text-[#141414]">
          <div className="flex justify-between items-start mb-8 border-b-2 border-[#141414] pb-6">
            <div>
              <h1 className="text-4xl font-bold tracking-tight italic serif">SAMRAT PIPE</h1>
              <p className="text-xs uppercase tracking-[0.2em] mt-2 opacity-60">Product Catalogue</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
          
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-12">S.No</th>
                <th className="py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">SKU / Code</th>
                <th className="py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Product Name</th>
                <th className="py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">HSN</th>
                <th className="py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.id} className="border-b border-gray-100 italic">
                  <td className="py-3 text-sm text-gray-400">{i + 1}</td>
                  <td className="py-3 text-sm font-mono text-gray-600">{p.sku}</td>
                  <td className="py-3 text-sm font-bold">{p.name}</td>
                  <td className="py-3 text-sm text-center text-gray-500">{p.hsn_code || '---'}</td>
                  <td className="py-3 text-sm font-bold text-right">{formatCurrency(p.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="mt-12 pt-8 border-t border-gray-100 flex justify-between items-center text-[10px] uppercase tracking-widest text-gray-400">
            <p>© {new Date().getFullYear()} SAMRAT PIPE INDUSTRIES</p>
            <p>Generated by ERP System</p>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-[#141414] mb-4">Confirm Action</h3>
            <p className="text-gray-600 mb-6">{confirmAction.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction.onConfirm}
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
