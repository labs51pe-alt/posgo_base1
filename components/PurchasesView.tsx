
import React, { useState, useEffect, useMemo } from 'react';
import { Product, Supplier, Purchase, StoreSettings } from '../types';
import { StorageService } from '../services/storageService';
import { 
    Search, Plus, Save, Trash2, Building2, ShoppingBag, 
    TrendingUp, Check, X, FileText, 
    Barcode, ChevronRight, Truck, Calendar, Package, AlertCircle,
    ArrowUpCircle, DollarSign, PieChart, Info, CreditCard, Clock, Inbox, Award, Smartphone, Zap
} from 'lucide-react';

interface PurchasesViewProps {
    products: Product[];
    suppliers: Supplier[];
    purchases: Purchase[];
    onProcessPurchase: (purchase: Purchase, updatedProducts: Product[]) => void;
    onAddSupplier: (supplier: Supplier) => void;
    onRequestNewProduct: (barcode?: string) => void;
    settings: StoreSettings;
    initialSearchTerm?: string;
    onClearInitialSearch?: () => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({ 
    products, suppliers, purchases, onProcessPurchase, onAddSupplier, 
    onRequestNewProduct, settings, initialSearchTerm, onClearInitialSearch
}) => {
    const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY' | 'SUPPLIERS' | 'REPORTS'>('NEW');
    const [productSearch, setProductSearch] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [purchaseCart, setPurchaseCart] = useState<any[]>([]);
    
    // Detalle y Pagos
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
    const [paymentInput, setPaymentInput] = useState('');
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
        
        const monthlyInversion = purchases
            .filter(p => new Date(p.date) >= startOfMonth)
            .reduce((sum, p) => sum + p.total, 0);

        const totalUnpaid = purchases
            .filter(p => p.status === 'PENDING')
            .reduce((sum, p) => sum + (p.total - p.amountPaid), 0);

        const pendingReceptionCount = purchases.filter(p => p.received === 'NO').length;

        return { monthlyInversion, totalUnpaid, pendingReceptionCount };
    }, [purchases]);

    const handleAddToPurchase = (product: Product) => {
        if (purchaseCart.find(i => i.id === product.id)) return;
        const suggestedCost = product.cost || (product.price * 0.7);
        setPurchaseCart([{
            ...product,
            quantity: 1,
            cost: suggestedCost,
            newPrice: product.price
        }, ...purchaseCart]);
        setProductSearch('');
    };

    const updatePurchaseItem = (id: string, field: string, value: any) => {
        setPurchaseCart(prev => prev.map(item => 
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const handleFinishPurchase = () => {
        if (!selectedSupplierId) { alert('Debes seleccionar un proveedor.'); return; }
        if (purchaseCart.length === 0) { alert('Agrega al menos un producto.'); return; }

        const total = purchaseCart.reduce((s, i) => s + (i.cost * i.quantity), 0);
        const purchase: Purchase = {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            supplierId: selectedSupplierId,
            invoiceNumber: invoiceNumber,
            total,
            amountPaid: total, 
            items: purchaseCart.map(i => ({ 
                productId: i.id, 
                productName: i.name, 
                quantity: i.quantity, 
                cost: i.cost 
            })),
            status: 'PAID', 
            received: 'YES' 
        };

        const updatedProducts = products.map(p => {
            const boughtItem = purchaseCart.find(i => i.id === p.id);
            if (boughtItem) {
                return { ...p, stock: p.stock + boughtItem.quantity, cost: boughtItem.cost, price: boughtItem.newPrice };
            }
            return p;
        });

        onProcessPurchase(purchase, updatedProducts);
        setPurchaseCart([]);
        setSelectedSupplierId('');
        setInvoiceNumber('');
        setActiveTab('HISTORY');
    };

    // --- FUNCIONES CLAVE DE EJECUCIÓN ---

    const handleQuickFullPayment = async () => {
        if (!selectedPurchase) return;
        setIsUpdating(true);
        const updated = { ...selectedPurchase, amountPaid: selectedPurchase.total, status: 'PAID' as const };
        await StorageService.updatePurchase(updated);
        setSelectedPurchase(updated);
        setIsUpdating(false);
        alert("Pago total registrado correctamente.");
    };

    const handlePartialPayment = async () => {
        if (!selectedPurchase || !paymentInput) return;
        const amt = parseFloat(paymentInput);
        if (isNaN(amt) || amt <= 0) return;

        setIsUpdating(true);
        const newPaid = Math.min(selectedPurchase.amountPaid + amt, selectedPurchase.total);
        const isCompleted = newPaid >= selectedPurchase.total - 0.01;
        
        const updated = { 
            ...selectedPurchase, 
            amountPaid: newPaid,
            status: isCompleted ? 'PAID' as const : 'PENDING' as const
        };
        
        await StorageService.updatePurchase(updated);
        setSelectedPurchase(updated);
        setPaymentInput('');
        setIsUpdating(false);
    };

    const handleConfirmWarehouseEntry = async () => {
        if (!selectedPurchase || selectedPurchase.received === 'YES') return;
        
        if (window.confirm("¿Confirmas que la mercadería ha sido recibida? Se actualizará el stock de todos los productos en la nube.")) {
            setIsUpdating(true);
            try {
                await StorageService.confirmReceptionAndSyncStock(selectedPurchase);
                const updated = { ...selectedPurchase, received: 'YES' as const };
                setSelectedPurchase(updated);
                alert("¡Stock sincronizado con éxito!");
            } catch (e) {
                alert("Error al procesar el ingreso.");
            } finally {
                setIsUpdating(false);
            }
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* Header Module */}
            <div className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center shrink-0 shadow-sm z-30">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <Truck className="w-7 h-7 text-amber-500" /> Módulo de Compras
                    </h1>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Control de Inventario y Gastos</p>
                </div>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('NEW')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${activeTab === 'NEW' ? 'bg-white shadow-md text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}>NUEVA COMPRA</button>
                    <button onClick={() => setActiveTab('HISTORY')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${activeTab === 'HISTORY' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>HISTORIAL</button>
                    <button onClick={() => setActiveTab('REPORTS')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${activeTab === 'REPORTS' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>REPORTES</button>
                    <button onClick={() => setActiveTab('SUPPLIERS')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${activeTab === 'SUPPLIERS' ? 'bg-white shadow-md text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}>PROVEEDORES</button>
                </div>
            </div>

            {activeTab === 'NEW' ? (
                <div className="flex-1 flex flex-col overflow-hidden p-6 lg:p-8 gap-6 animate-fade-in">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm shrink-0 items-end">
                        <div className="lg:col-span-2 space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Building2 className="w-3.5 h-3.5"/> Proveedor Seleccionado</label>
                            <div className="flex gap-2">
                                <select className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:border-amber-400 appearance-none" value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)}>
                                    <option value="">Elegir Proveedor...</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <button onClick={() => setIsSupplierModalOpen(true)} className="p-4 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 hover:bg-amber-100"><Plus className="w-6 h-6 stroke-[3px]"/></button>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><FileText className="w-3.5 h-3.5"/> Documento</label>
                            <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none focus:border-amber-400" placeholder="Ej: F001-123" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}/>
                        </div>
                        <div className="flex flex-col items-end">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Inversión Total</p>
                            <p className="text-4xl font-black text-slate-900 tracking-tighter">{settings.currency}{purchaseCart.reduce((s, i) => s + (i.cost * i.quantity), 0).toFixed(2)}</p>
                        </div>
                    </div>
                    {/* ... (resto del POS de compras igual) ... */}
                    <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0">
                        <div className="w-full lg:w-[380px] flex flex-col bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden shrink-0">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                <div className="relative">
                                    <input className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 rounded-2xl font-bold outline-none focus:border-amber-400" placeholder="Buscar producto..." value={productSearch} onChange={e => setProductSearch(e.target.value)}/>
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 space-y-1">
                                {filteredSearchProducts.map(p => (
                                    <button key={p.id} onClick={() => handleAddToPurchase(p)} className="w-full text-left p-4 rounded-2xl hover:bg-amber-50/50 flex items-center gap-4 border border-transparent hover:border-amber-100 transition-all group">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:bg-amber-500 group-hover:text-white">{p.name.charAt(0)}</div>
                                        <div className="flex-1 min-w-0"><p className="font-black text-slate-800 text-sm truncate">{p.name}</p><p className="text-[10px] font-bold text-slate-400 uppercase">Stock: {p.stock} un.</p></div>
                                        <Plus className="w-4 h-4 text-slate-300 group-hover:text-amber-500" />
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex