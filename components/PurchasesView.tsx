
import React, { useState, useEffect, useMemo } from 'react';
import { Product, Supplier, Purchase, StoreSettings } from '../types';
import { StorageService } from '../services/storageService';
import { 
    Search, Plus, Save, Trash2, Building2, ShoppingBag, 
    TrendingUp, Check, X, FileText, 
    Barcode, ChevronRight, Truck, Calendar, Package, AlertCircle,
    ArrowUpCircle, DollarSign, PieChart, Info, CreditCard, Clock, Inbox, Award, Smartphone, Zap, Loader2, Wallet, Banknote
} from 'lucide-react';

interface PurchasesViewProps {
    products: Product[];
    suppliers: Supplier[];
    purchases: Purchase[];
    onProcessPurchase: (purchase: Purchase, updatedProducts: Product[]) => Promise<void>;
    onAddSupplier: (supplier: Supplier) => void;
    onRequestNewProduct: (barcode?: string) => void;
    settings: StoreSettings;
    initialSearchTerm?: string;
    onClearInitialSearch?: () => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({ 
    products, suppliers, purchases = [], onProcessPurchase, onAddSupplier, 
    onRequestNewProduct, settings, initialSearchTerm, onClearInitialSearch
}) => {
    const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY' | 'SUPPLIERS' | 'REPORTS'>('NEW');
    const [productSearch, setProductSearch] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'credit'>('cash');
    const [purchaseCart, setPurchaseCart] = useState<any[]>([]);
    
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [newSupplierName, setNewSupplierName] = useState('');
    const [newSupplierContact, setNewSupplierContact] = useState('');

    useEffect(() => {
        if (initialSearchTerm) {
            setProductSearch(initialSearchTerm);
            setActiveTab('NEW');
            if (onClearInitialSearch) onClearInitialSearch();
        }
    }, [initialSearchTerm, onClearInitialSearch]);

    const filteredSearchProducts = useMemo(() => {
        if (!productSearch || productSearch.length < 2) return [];
        return products.filter(p => 
            p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
            (p.barcode && p.barcode.includes(productSearch))
        ).slice(0, 8);
    }, [products, productSearch]);

    const reports = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyInversion = purchases.filter(p => new Date(p.date) >= startOfMonth).reduce((sum, p) => sum + (p.total || 0), 0);
        const totalUnpaid = purchases.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + ((p.total || 0) - (p.amountPaid || 0)), 0);
        const pendingReceptionCount = purchases.filter(p => p.received === 'NO').length;
        return { monthlyInversion, totalUnpaid, pendingReceptionCount };
    }, [purchases]);

    const handleAddToPurchase = (product: Product) => {
        if (purchaseCart.find(i => i.id === product.id)) return;
        const suggestedCost = product.cost || (product.price * 0.7);
        setPurchaseCart([{ ...product, quantity: 1, cost: suggestedCost, newPrice: product.price }, ...purchaseCart]);
        setProductSearch('');
    };

    const updatePurchaseItem = (id: string, field: string, value: any) => {
        setPurchaseCart(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleFinishPurchase = async () => {
        if (!selectedSupplierId) { alert('Debes seleccionar un proveedor.'); return; }
        if (purchaseCart.length === 0) { alert('Agrega al menos un producto.'); return; }

        setIsUpdating(true);
        try {
            const total = purchaseCart.reduce((s, i) => s + ((i.cost || 0) * (i.quantity || 0)), 0);
            
            // Si es crédito, el monto pagado es 0, si es contado es el total
            const isCredit = paymentMethod === 'credit';
            
            const purchase: Purchase = {
                id: crypto.randomUUID(), 
                date: new Date().toISOString(), 
                supplierId: selectedSupplierId,
                invoiceNumber: invoiceNumber, 
                total, 
                amountPaid: isCredit ? 0 : total, 
                paymentMethod: paymentMethod,
                items: purchaseCart.map(i => ({ productId: i.id, productName: i.name, quantity: i.quantity, cost: i.cost })),
                status: isCredit ? 'PENDING' : 'PAID', 
                received: 'YES' 
            };

            const updatedProducts = products.map(p => {
                const boughtItem = purchaseCart.find(i => i.id === p.id);
                if (boughtItem) return { ...p, stock: p.stock + (boughtItem.quantity || 0), cost: boughtItem.cost, price: boughtItem.newPrice };
                return p;
            });

            await onProcessPurchase(purchase, updatedProducts);
            
            setPurchaseCart([]);
            setSelectedSupplierId('');
            setInvoiceNumber('');
            alert("¡Compra procesada y stock actualizado!");
            setActiveTab('HISTORY');
        } catch (e: any) {
            console.error(e);
            alert("Error al guardar: " + (e?.message || "Revisar conexión"));
        } finally {
            setIsUpdating(false);
        }
    };

    const handleConfirmWarehouseEntry = async () => {
        if (!selectedPurchase || selectedPurchase.received === 'YES') return;
        if (window.confirm("¿Ingresar mercadería al stock ahora?")) {
            setIsUpdating(true);
            try {
                await StorageService.confirmReceptionAndSyncStock(selectedPurchase);
                setSelectedPurchase({ ...selectedPurchase, received: 'YES' });
                alert("Stock actualizado.");
            } catch (e: any) {
                alert("Error: " + (e?.message || "No se pudo sincronizar"));
            } finally {
                setIsUpdating(false);
            }
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
            <div className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center shrink-0 shadow-sm z-30">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <Truck className="w-7 h-7 text-amber-500" /> Compras & Almacén
                    </h1>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Gestión Cloud de Proveedores</p>
                </div>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                    <button onClick={() => setActiveTab('NEW')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'NEW' ? 'bg-white shadow-md text-amber-600' : 'text-slate-400'}`}>NUEVA</button>
                    <button onClick={() => setActiveTab('HISTORY')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'HISTORY' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400'}`}>HISTORIAL</button>
                    <button onClick={() => setActiveTab('REPORTS')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'REPORTS' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}>REPORTE</button>
                    <button onClick={() => setActiveTab('SUPPLIERS')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'SUPPLIERS' ? 'bg-white shadow-md text-emerald-600' : 'text-slate-400'}`}>PROVEEDORES</button>
                </div>
            </div>

            {activeTab === 'NEW' && (
                <div className="flex-1 flex flex-col overflow-hidden p-8 gap-6 animate-fade-in">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm shrink-0 items-end">
                        <div className="lg:col-span-1 space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Proveedor</label>
                            <div className="flex gap-2">
                                <select className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:border-amber-400" value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)}>
                                    <option value="">Seleccionar...</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Documento</label>
                            <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none focus:border-amber-400" placeholder="Ej: F001-001" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}/>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Forma de Pago</label>
                            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                                <button onClick={() => setPaymentMethod('cash')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${paymentMethod === 'cash' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Contado</button>
                                <button onClick={() => setPaymentMethod('transfer')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${paymentMethod === 'transfer' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Transf.</button>
                                <button onClick={() => setPaymentMethod('credit')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${paymentMethod === 'credit' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>Crédito</button>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Inversión</p>
                            <p className="text-4xl font-black text-slate-900 tracking-tighter">
                                {settings.currency}{(purchaseCart.reduce((s, i) => s + ((i.cost || 0) * (i.quantity || 0)), 0)).toFixed(2)}
                            </p>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0">
                        <div className="w-full lg:w-[350px] flex flex-col bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden shrink-0">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                                    <input className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 rounded-2xl font-bold outline-none focus:border-amber-400" placeholder="Buscar producto..." value={productSearch} onChange={e => setProductSearch(e.target.value)}/>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                                {filteredSearchProducts.map(p => (
                                    <button key={p.id} onClick={() => handleAddToPurchase(p)} className="w-full text-left p-4 rounded-2xl hover:bg-amber-50 flex items-center gap-4 transition-all border border-transparent hover:border-amber-100 mb-1">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400">{p.name.charAt(0)}</div>
                                        <div className="flex-1 min-w-0"><p className="font-bold text-slate-800 text-sm truncate">{p.name}</p><p className="text-[10px] font-bold text-slate-400">P. Venta: {settings.currency}{p.price}</p></div>
                                        <Plus className="w-4 h-4 text-slate-300" />
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50/80 text-[10px] font-black uppercase text-slate-400 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-6">Detalle</th>
                                            <th className="p-6 text-center w-24">Cant.</th>
                                            <th className="p-6 text-right w-32">Costo U.</th>
                                            <th className="p-6 text-right w-32">Subtotal</th>
                                            <th className="p-6 w-16"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {purchaseCart.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50/30 transition-colors">
                                                <td className="p-6 font-bold text-slate-800 text-sm">{item.name}</td>
                                                <td className="p-3 w-24"><input type="number" className="w-full bg-slate-50 rounded-xl px-1 py-3 text-center font-bold" value={item.quantity} onChange={e => updatePurchaseItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}/></td>
                                                <td className="p-3 w-32"><input type="number" className="w-full bg-white border border-slate-100 rounded-xl px-2 py-3 text-right font-bold" value={item.cost} onChange={e => updatePurchaseItem(item.id, 'cost', parseFloat(e.target.value) || 0)}/></td>
                                                <td className="p-6 text-right font-black text-slate-900">{settings.currency}{((item.cost || 0) * (item.quantity || 0)).toFixed(2)}</td>
                                                <td className="p-6 text-right"><button onClick={() => setPurchaseCart(prev => prev.filter(i => i.id !== item.id))} className="text-slate-200 hover:text-rose-500"><Trash2 className="w-5 h-5"/></button></td>
                                            </tr>
                                        ))}
                                        {purchaseCart.length === 0 && (
                                            <tr><td colSpan={5} className="p-20 text-center text-slate-300 font-bold italic">Agrega productos para procesar la compra</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
                                <button onClick={() => setPurchaseCart([])} className="px-6 py-4 text-slate-400 font-black text-xs hover:text-rose-500 transition-colors">VACIAR CARRITO</button>
                                <button onClick={handleFinishPurchase} disabled={purchaseCart.length === 0 || !selectedSupplierId || isUpdating} className="px-10 py-5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-20 text-white rounded-[1.8rem] font-black shadow-xl flex items-center gap-3 transition-all active:scale-95">
                                    {isUpdating ? <Loader2 className="w-6 h-6 animate-spin"/> : <Save className="w-6 h-6"/>}
                                    GUARDAR COMPRA
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'HISTORY' && (
                <div className="flex-1 overflow-y-auto p-8 animate-fade-in">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                                <tr>
                                    <th className="p-6">Fecha</th>
                                    <th className="p-6">Documento</th>
                                    <th className="p-6">Proveedor</th>
                                    <th className="p-6">Tipo</th>
                                    <th className="p-6">Pago</th>
                                    <th className="p-6 text-right">Inversión</th>
                                    <th className="p-6"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {purchases.length === 0 ? (
                                    <tr><td colSpan={7} className="p-20 text-center text-slate-400 font-bold">No hay compras registradas en la nube</td></tr>
                                ) : purchases.map(p => (
                                    <tr key={p.id} onClick={() => setSelectedPurchase(p)} className="hover:bg-slate-50 cursor-pointer group transition-colors">
                                        <td className="p-6 font-bold text-slate-700">{new Date(p.date).toLocaleDateString()}</td>
                                        <td className="p-6 font-mono text-xs text-slate-400">{p.invoiceNumber || 'S/N'}</td>
                                        <td className="p-6 font-bold text-slate-800">{suppliers.find(s => s.id === p.supplierId)?.name || 'Desconocido'}</td>
                                        <td className="p-6"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${p.paymentMethod === 'credit' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>{p.paymentMethod === 'credit' ? 'Crédito' : 'Contado'}</span></td>
                                        <td className="p-6"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${p.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{p.status === 'PAID' ? 'Liquidado' : 'Pendiente'}</span></td>
                                        <td className="p-6 text-right font-black text-slate-900">{settings.currency}{(p.total || 0).toFixed(2)}</td>
                                        <td className="p-6 text-right"><ChevronRight className="w-6 h-6 text-slate-200 group-hover:text-indigo-500"/></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'REPORTS' && (
                <div className="flex-1 overflow-y-auto p-8 animate-fade-in space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Compras del Mes</p><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600"><TrendingUp className="w-6 h-6"/></div><p className="text-4xl font-black text-slate-800">{settings.currency}{(reports.monthlyInversion || 0).toLocaleString()}</p></div></div>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-rose-100 shadow-sm shadow-rose-50"><p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-3">Deuda a Proveedores</p><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600"><Wallet className="w-6 h-6"/></div><p className="text-4xl font-black text-rose-800">{settings.currency}{(reports.totalUnpaid || 0).toLocaleString()}</p></div></div>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-amber-100 shadow-sm shadow-amber-50"><p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-3">Recepciones Pendientes</p><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600"><Clock className="w-6 h-6"/></div><p className="text-4xl font-black text-amber-800">{reports.pendingReceptionCount || 0}</p></div></div>
                    </div>
                </div>
            )}

            {activeTab === 'SUPPLIERS' && (
                <div className="flex-1 overflow-y-auto p-8 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <button onClick={() => setIsSupplierModalOpen(true)} className="aspect-square bg-white border-2 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-emerald-500 hover:text-emerald-600 transition-all group">
                            <Plus className="w-14 h-14 group-hover:scale-110 transition-transform" /><span className="font-black text-[11px] uppercase tracking-widest">Nuevo Proveedor</span>
                        </button>
                        {suppliers.map(s => (
                            <div key={s.id} className="bg-white aspect-square rounded-[3rem] border border-slate-100 p-10 shadow-sm hover:shadow-2xl transition-all flex flex-col justify-between group">
                                <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-all"><Building2 className="w-8 h-8" /></div>
                                <div className="mt-6"><h3 className="text-2xl font-black text-slate-800 leading-tight mb-2 truncate">{s.name}</h3><div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest"><Calendar className="w-3.5 h-3.5" /> {s.contact || 'Sin datos'}</div></div>
                                <div className="pt-6 border-t border-slate-50 flex justify-between items-center"><span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-xl">ACTIVO</span><ChevronRight className="w-6 h-6 text-slate-200" /></div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* MODAL DETALLE COMPRA */}
            {selectedPurchase && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[150] flex justify-center items-center p-4">
                    <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl animate-fade-in-up flex flex-col overflow-hidden border border-white/20">
                        <div className="p-8 border-b border-slate-50 bg-[#0f172a] text-white flex justify-between items-center">
                            <div><h3 className="text-2xl font-black tracking-tight mb-1">Comprobante de Compra</h3><p className="text-slate-400 text-[10px] font-black uppercase">N° {selectedPurchase.invoiceNumber || 'S/N'}</p></div>
                            <button onClick={() => setSelectedPurchase(null)} className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center"><X className="w-6 h-6"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 text-center">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">ESTADO PAGO</p>
                                    <div className={`py-3 rounded-xl text-[10px] font-black uppercase ${selectedPurchase.status === 'PAID' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>{selectedPurchase.status === 'PAID' ? 'LIQUIDADO' : 'PENDIENTE'}</div>
                                    <p className="mt-2 text-[10px] font-bold text-slate-500">Abonado: {settings.currency}{(selectedPurchase.amountPaid || 0).toFixed(2)}</p>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 text-center">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">ALMACÉN</p>
                                    <button onClick={handleConfirmWarehouseEntry} disabled={selectedPurchase.received === 'YES' || isUpdating} className={`w-full py-3 rounded-xl text-[10px] font-black uppercase transition-all ${selectedPurchase.received === 'YES' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-amber-500 text-white hover:scale-105 active:scale-95'}`}>{selectedPurchase.received === 'YES' ? 'INGRESADA' : 'RECIBIR STOCK'}</button>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Inbox className="w-4 h-4 text-indigo-500"/> ITEMS COMPRADOS</h4>
                                <div className="space-y-2">
                                    {selectedPurchase.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="min-w-0 flex-1 pr-4"><p className="font-black text-slate-800 text-sm truncate">{item.productName || 'Producto'}</p><p className="text-[10px] text-slate-400 font-bold uppercase">Costo: {settings.currency}{(item.cost || 0).toFixed(2)}</p></div>
                                            <div className="text-right"><p className="font-black text-slate-500 text-xs">x{item.quantity || 0}</p><p className="font-black text-indigo-600 text-sm leading-none">{settings.currency}{((item.cost || 0) * (item.quantity || 0)).toFixed(2)}</p></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-8 border-t border-slate-50 bg-white flex justify-between items-center">
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">TOTAL DOCUMENTO</p>
                            <p className="text-4xl font-black text-[#0f172a]">{settings.currency}{(selectedPurchase.total || 0).toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            )}

            {isSupplierModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[250] flex items-center justify-center p-6 animate-fade-in">
                    <div className="bg-white rounded-[3.5rem] w-full max-w-md p-12 shadow-2xl animate-fade-in-up border border-slate-100">
                        <div className="flex justify-between items-center mb-10"><h3 className="text-3xl font-black text-slate-800 tracking-tight">Nuevo Proveedor</h3><button onClick={() => setIsSupplierModalOpen(false)} className="w-12 h-12 bg-slate-50 hover:bg-rose-50 rounded-full flex items-center justify-center transition-all group"><X className="w-6 h-6 text-slate-300 group-hover:text-rose-500"/></button></div>
                        <div className="space-y-8 mb-12"><div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Nombre Comercial</label><input className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-5 font-bold outline-none focus:border-emerald-500" placeholder="Ej: Distribuidora Central" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} /></div><div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Teléfono / Celular</label><input className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-5 font-bold outline-none focus:border-emerald-500" placeholder="Ej: 999 000 123" value={newSupplierContact} onChange={e => setNewSupplierContact(e.target.value)} /></div></div>
                        <button onClick={() => { if(!newSupplierName) return; onAddSupplier({ id: crypto.randomUUID(), name: newSupplierName, contact: newSupplierContact }); setIsSupplierModalOpen(false); setNewSupplierName(''); setNewSupplierContact(''); }} className="w-full py-6 bg-slate-900 text-white rounded-[2.5rem] font-black shadow-2xl hover:bg-black transition-all">GUARDAR PROVEEDOR</button>
                    </div>
                </div>
            )}
        </div>
    );
};
