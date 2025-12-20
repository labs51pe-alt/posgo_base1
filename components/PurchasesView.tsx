
import React, { useState, useMemo, useEffect } from 'react';
import { Product, Supplier, Purchase, StoreSettings, PurchaseStatus, PurchaseItem, PaymentMethod } from '../types';
import { 
    Search, Plus, Save, Trash2, Building2, 
    ChevronRight, Truck, Calendar, Package, 
    X, FileText, Download, Filter, List, 
    LayoutGrid, ArrowUpCircle, Wallet, Clock, 
    CheckCircle2, AlertCircle, Inbox, Info,
    Tag, CreditCard, Receipt, Edit2, RotateCcw,
    TrendingUp, Gift, Calculator, UserPlus, ArrowLeftRight,
    Coins, Landmark, Smartphone, Zap, Landmark as BankIcon,
    Banknote, RefreshCw, Eye, User
} from 'lucide-react';

interface PurchasesViewProps {
    products: Product[];
    suppliers: Supplier[];
    purchases: Purchase[];
    onProcessPurchase: (purchase: Purchase, updatedProducts: Product[]) => Promise<void>;
    onConfirmReception: (purchase: Purchase) => Promise<void>;
    onRevertReception: (purchase: Purchase) => Promise<void>;
    onAddSupplier: (supplier: Supplier) => void;
    onRequestNewProduct: (barcode?: string) => void;
    settings: StoreSettings;
    initialSearchTerm?: string;
    onClearInitialSearch?: () => void;
}

type KpiFilter = 'ALL' | 'PENDING' | 'DEBT';

export const PurchasesView: React.FC<PurchasesViewProps> = ({ 
    products, suppliers, purchases = [], onProcessPurchase, onConfirmReception, onRevertReception, onAddSupplier, 
    onRequestNewProduct, settings, initialSearchTerm, onClearInitialSearch 
}) => {
    const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSuppliersModalOpen, setIsSuppliersModalOpen] = useState(false);
    const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [activeKpi, setActiveKpi] = useState<KpiFilter>('ALL');

    // Form States
    const [items, setItems] = useState<any[]>([]);
    const [supplierId, setSupplierId] = useState('');
    const [invoice, setInvoice] = useState('');
    const [condition, setCondition] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
    const [amountPaid, setAmountPaid] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [payFromCash, setPayFromCash] = useState(false); 
    const [taxIncluded, setTaxIncluded] = useState(true);
    const [prodSearch, setProdSearch] = useState('');

    // Quick Supplier State
    const [showSupplierForm, setShowSupplierForm] = useState(false);
    const [newSuppName, setNewSuppName] = useState('');

    useEffect(() => {
        if (initialSearchTerm) setSearchTerm(initialSearchTerm);
    }, [initialSearchTerm]);

    const openCreate = () => {
        setEditingPurchase(null);
        setItems([]);
        setSupplierId('');
        setInvoice('');
        setCondition('CONTADO');
        setAmountPaid('');
        setPaymentMethod('cash');
        setPayFromCash(false);
        setTaxIncluded(true);
        setIsModalOpen(true);
        setIsSaving(false);
    };

    const openEdit = (p: Purchase) => {
        setEditingPurchase(p);
        setItems(p.items.map(i => {
            const prod = products.find(pr => pr.id === i.productId);
            return { 
                ...prod, 
                ...i, 
                id: i.productId, 
                name: i.productName || prod?.name,
                isBonus: !!i.isBonus,
                newSellPrice: i.newSellPrice || prod?.price || 0 
            };
        }));
        setSupplierId(p.supplierId);
        setInvoice(p.invoiceNumber || '');
        setCondition(p.paymentCondition);
        setAmountPaid(p.amountPaid.toString());
        setPaymentMethod((p.paymentMethod as PaymentMethod) || 'cash');
        setPayFromCash(p.payFromCash);
        setTaxIncluded(p.taxIncluded);
        setIsModalOpen(true);
        setIsSaving(false);
    };

    const isReadOnly = editingPurchase?.status === 'RECIBIDO';

    const totals = useMemo(() => {
        const subtotalRaw = items.reduce((s, i) => s + (i.isBonus ? 0 : (i.cost * i.quantity)), 0);
        let tax = 0;
        let total = subtotalRaw;
        let subtotal = subtotalRaw;

        if (taxIncluded) {
            tax = subtotalRaw - (subtotalRaw / (1 + settings.taxRate));
            subtotal = subtotalRaw - tax;
        } else {
            tax = subtotalRaw * settings.taxRate;
            total = subtotalRaw + tax;
        }

        return { subtotal, tax, total };
    }, [items, taxIncluded, settings.taxRate]);

    const addItem = (p: Product) => {
        if (isReadOnly) return;
        if (items.find(i => i.id === p.id)) return;
        setItems([...items, { ...p, quantity: 1, cost: p.cost || 0, isBonus: false, newSellPrice: p.price }]);
        setProdSearch('');
    };

    const handleQuickSupplier = async () => {
        if (!newSuppName) return;
        const newSupp: Supplier = { id: crypto.randomUUID(), name: newSuppName };
        onAddSupplier(newSupp);
        setSupplierId(newSupp.id);
        setNewSuppName('');
        setShowSupplierForm(false);
    };

    const handleSave = async (status: PurchaseStatus) => {
        if (isReadOnly) return;
        if (!supplierId) {
            alert("⚠️ Debes seleccionar un proveedor.");
            return;
        }
        if (items.length === 0) {
            alert("⚠️ La compra no tiene productos.");
            return;
        }

        setIsSaving(true);
        const purchase: Purchase = {
            id: editingPurchase?.id || crypto.randomUUID(),
            reference: editingPurchase?.reference || `P${(purchases.length + 1).toString().padStart(5, '0')}`,
            date: editingPurchase?.date || new Date().toISOString(),
            supplierId,
            invoiceNumber: invoice,
            paymentCondition: condition,
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
            amountPaid: condition === 'CONTADO' ? totals.total : (parseFloat(amountPaid) || 0),
            paymentMethod: paymentMethod,
            payFromCash,
            taxIncluded,
            status,
            received: editingPurchase?.received || 'NO',
            items: items.map(i => ({ 
                productId: i.id, 
                productName: i.name, 
                quantity: i.quantity, 
                cost: i.cost,
                isBonus: i.isBonus,
                newSellPrice: i.newSellPrice
            }))
        };

        try {
            await onProcessPurchase(purchase, []);
            setIsModalOpen(false);
            if (onClearInitialSearch) onClearInitialSearch();
        } catch (e: any) {
            alert("❌ Error al procesar: " + (e.message || "Error desconocido"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmReceptionWithFeedback = async (p: Purchase) => {
        if (!window.confirm("¿Confirmar recepción? Se actualizará el inventario.")) return;
        await onConfirmReception(p);
    };

    const handleRevertReceptionWithFeedback = async (p: Purchase) => {
        if (!window.confirm("⚠️ ¿REVERTIR INGRESO? El stock será restado.")) return;
        await onRevertReception(p);
    };

    const filteredPurchases = useMemo(() => {
        let list = purchases.filter(p => {
            const supplierName = suppliers.find(s => s.id === p.supplierId)?.name || '';
            return p.reference.toLowerCase().includes(searchTerm.toLowerCase()) || 
                   supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   p.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
        });

        if (activeKpi === 'PENDING') list = list.filter(p => p.received === 'NO');
        if (activeKpi === 'DEBT') list = list.filter(p => p.total > p.amountPaid);

        return list;
    }, [purchases, searchTerm, suppliers, activeKpi]);

    const getPaymentIcon = (method?: string) => {
        switch (method) {
            case 'cash': return <Banknote className="w-3.5 h-3.5" />;
            case 'yape': return <Smartphone className="w-3.5 h-3.5 text-purple-600" />;
            case 'plin': return <Zap className="w-3.5 h-3.5 text-cyan-500" />;
            case 'transfer': return <BankIcon className="w-3.5 h-3.5 text-blue-600" />;
            default: return <Wallet className="w-3.5 h-3.5" />;
        }
    };

    const getMethodName = (method?: string) => {
        switch (method) {
            case 'cash': return 'Efectivo';
            case 'yape': return 'Yape';
            case 'plin': return 'Plin';
            case 'transfer': return 'Banco/Transf.';
            default: return 'Otro';
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#f8fafc] overflow-hidden font-sans">
            
            {/* CABECERA ERP */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 shrink-0 shadow-sm z-10">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                             <Truck className="w-8 h-8 text-indigo-600"/> Gestión de Compras
                        </h1>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Abastecimiento y Control de Pagos</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setIsSuppliersModalOpen(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all">
                            <Building2 className="w-5 h-5 text-slate-500" /> Proveedores
                        </button>
                        <button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 flex items-center gap-2 transition-all active:scale-95 uppercase tracking-wider">
                            <Plus className="w-5 h-5 stroke-[3px]" /> Nueva Compra
                        </button>
                    </div>
                </div>

                {/* KPI Cards Interactivos */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <button 
                        onClick={() => setActiveKpi('ALL')}
                        className={`text-left p-4 rounded-2xl border-2 transition-all group ${activeKpi === 'ALL' ? 'bg-indigo-50 border-indigo-200 shadow-md' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}
                    >
                        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${activeKpi === 'ALL' ? 'text-indigo-600' : 'text-slate-400'}`}>Inversión Total</p>
                        <p className={`text-xl font-black ${activeKpi === 'ALL' ? 'text-indigo-900' : 'text-slate-800'}`}>{settings.currency}{purchases.reduce((s,p) => s + p.total, 0).toLocaleString()}</p>
                    </button>

                    <button 
                        onClick={() => setActiveKpi('PENDING')}
                        className={`text-left p-4 rounded-2xl border-2 transition-all group ${activeKpi === 'PENDING' ? 'bg-amber-50 border-amber-200 shadow-md' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}
                    >
                        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${activeKpi === 'PENDING' ? 'text-amber-600' : 'text-amber-400'}`}>Por Recibir</p>
                        <p className={`text-xl font-black ${activeKpi === 'PENDING' ? 'text-amber-900' : 'text-amber-700'}`}>{purchases.filter(p => p.received === 'NO').length} pedidos</p>
                    </button>

                    <button 
                        onClick={() => setActiveKpi('DEBT')}
                        className={`text-left p-4 rounded-2xl border-2 transition-all group ${activeKpi === 'DEBT' ? 'bg-rose-50 border-rose-200 shadow-md' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}
                    >
                        <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${activeKpi === 'DEBT' ? 'text-rose-600' : 'text-rose-400'}`}>Deuda a Prov.</p>
                        <p className={`text-xl font-black ${activeKpi === 'DEBT' ? 'text-rose-900' : 'text-rose-700'}`}>{settings.currency}{purchases.reduce((s,p) => s + (p.total - p.amountPaid), 0).toLocaleString()}</p>
                    </button>

                    <div className="bg-emerald-50 border-2 border-emerald-100 p-4 rounded-2xl cursor-default">
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Proveedores</p>
                        <p className="text-xl font-black text-emerald-700">{suppliers.length} activos</p>
                    </div>
                </div>
            </div>

            {/* CUERPO PRINCIPAL */}
            <div className="p-8 flex-1 flex flex-col overflow-hidden">
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
                    
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-4 flex-1">
                            <div className="flex-1 max-w-md relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-400 shadow-sm" 
                                    placeholder="Buscar referencia o proveedor..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            {activeKpi !== 'ALL' && (
                                <button 
                                    onClick={() => setActiveKpi('ALL')}
                                    className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-2"
                                >
                                    <X className="w-3 h-3" /> Quitar Filtro
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 sticky top-0 z-10 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th className="p-6">Doc/Ref</th>
                                    <th className="p-6">Proveedor</th>
                                    <th className="p-6">Monto Total</th>
                                    <th className="p-6">Pagado</th>
                                    <th className="p-6">Método y Origen</th>
                                    <th className="p-6 text-center">Almacén</th>
                                    <th className="p-6 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredPurchases.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-20 text-center text-slate-300 font-black italic uppercase tracking-widest">No hay compras con este filtro</td>
                                    </tr>
                                ) : filteredPurchases.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="p-6">
                                            <p className="font-black text-indigo-600 text-sm">{p.reference}</p>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase">{new Date(p.date).toLocaleDateString()}</p>
                                        </td>
                                        <td className="p-6 font-bold text-slate-700 text-sm">
                                            {suppliers.find(s => s.id === p.supplierId)?.name || 'Desconocido'}
                                        </td>
                                        <td className="p-6 font-black text-slate-800 text-sm">
                                            {settings.currency}{p.total.toFixed(2)}
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-600">{settings.currency}{p.amountPaid.toFixed(2)}</span>
                                                {p.total > p.amountPaid && (
                                                    <span className="text-[9px] text-rose-500 font-black">PEND: {settings.currency}{(p.total - p.amountPaid).toFixed(2)}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-slate-600">
                                                    {getPaymentIcon(p.paymentMethod)}
                                                    <span className="text-[10px] font-black uppercase tracking-tighter">{getMethodName(p.paymentMethod)}</span>
                                                </div>
                                                {p.payFromCash ? (
                                                    <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 w-fit uppercase">Viene de Caja</span>
                                                ) : (
                                                    <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 w-fit uppercase">Externo</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-6 text-center">
                                            {p.received === 'YES' ? (
                                                <button 
                                                    onClick={() => handleRevertReceptionWithFeedback(p)}
                                                    className="flex items-center justify-center gap-1 text-rose-600 font-black text-[10px] hover:bg-rose-50 px-2 py-1.5 rounded-lg border border-rose-100 transition-all group/rev mx-auto"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5 group-hover/rev:rotate-[-45deg] transition-transform"/> REVERTIR
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => handleConfirmReceptionWithFeedback(p)}
                                                    className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black hover:bg-amber-100 transition-colors uppercase border border-amber-100 mx-auto block"
                                                >
                                                    INGRESAR STOCK
                                                </button>
                                            )}
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="flex justify-end gap-2">
                                                {p.status !== 'RECIBIDO' && (
                                                    <button onClick={() => openEdit(p)} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors" title="Editar"><Edit2 className="w-4 h-4"/></button>
                                                )}
                                                <button onClick={() => openEdit(p)} className="p-2 text-slate-300 hover:text-slate-600 transition-colors" title="Ver Detalle"><ChevronRight className="w-5 h-5"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* MODAL GESTIÓN DE PROVEEDORES */}
            {isSuppliersModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl h-[80vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3"><Building2 className="w-7 h-7 text-indigo-500"/> Proveedores</h2>
                                <p className="text-slate-400 text-xs font-bold uppercase mt-1">Directorio de Abastecimiento</p>
                            </div>
                            <button onClick={() => setIsSuppliersModalOpen(false)} className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all shadow-sm">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            <div className="flex gap-4">
                                <input 
                                    className="flex-1 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-indigo-400 focus:bg-white transition-all"
                                    placeholder="Nombre del nuevo proveedor..."
                                    value={newSuppName}
                                    onChange={e => setNewSuppName(e.target.value)}
                                />
                                <button 
                                    onClick={handleQuickSupplier}
                                    className="bg-indigo-600 text-white px-6 rounded-2xl font-black hover:bg-indigo-700 transition-all flex items-center gap-2"
                                >
                                    <Plus className="w-5 h-5"/> AGREGAR
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-8">
                            <div className="grid grid-cols-1 gap-3">
                                {suppliers.length === 0 ? (
                                    <div className="text-center py-20 text-slate-300 font-bold uppercase italic tracking-widest">No hay proveedores registrados</div>
                                ) : suppliers.map(s => (
                                    <div key={s.id} className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 font-black shadow-sm">{s.name.charAt(0)}</div>
                                            <span className="font-bold text-slate-700">{s.name}</span>
                                        </div>
                                        <button className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CREAR/EDITAR COMPRA */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-6xl h-[92vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
                        
                        {/* Modal Header */}
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                    {isReadOnly ? <Eye className="w-7 h-7 text-indigo-500"/> : <Receipt className="w-7 h-7 text-indigo-500"/>} 
                                    {isReadOnly ? 'Detalle de Compra (Lectura)' : editingPurchase ? 'Modificar Registro' : 'Nueva Orden de Compra'}
                                </h2>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">
                                    {isReadOnly ? 'Esta orden ya fue ingresada al inventario y no permite cambios.' : 'Configuración Financiera y de Inventario'}
                                </p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all shadow-sm">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                            
                            {/* Form Top */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="space-y-2 relative">
                                    <div className="flex justify-between items-center ml-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Proveedor</label>
                                        {!isReadOnly && <button onClick={() => setShowSupplierForm(!showSupplierForm)} className="text-[10px] font-black text-indigo-500 hover:underline">+ RÁPIDO</button>}
                                    </div>
                                    
                                    {showSupplierForm && !isReadOnly ? (
                                        <div className="flex gap-2 animate-fade-in">
                                            <input 
                                                className="flex-1 p-3 bg-white border-2 border-indigo-200 rounded-xl font-bold text-sm outline-none"
                                                placeholder="Nombre..."
                                                value={newSuppName}
                                                onChange={e => setNewSuppName(e.target.value)}
                                                autoFocus
                                            />
                                            <button onClick={handleQuickSupplier} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors"><UserPlus className="w-4 h-4"/></button>
                                        </div>
                                    ) : (
                                        <select 
                                            disabled={isReadOnly}
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all disabled:opacity-70"
                                            value={supplierId}
                                            onChange={e => setSupplierId(e.target.value)}
                                        >
                                            <option value="">Seleccione...</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">N° Comprobante</label>
                                    <input 
                                        disabled={isReadOnly}
                                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all disabled:opacity-70"
                                        placeholder="Ej: F001-234"
                                        value={invoice}
                                        onChange={e => setInvoice(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Condición de Pago</label>
                                    <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                                        <button disabled={isReadOnly} onClick={() => setCondition('CONTADO')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black transition-all ${condition === 'CONTADO' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>CONTADO</button>
                                        <button disabled={isReadOnly} onClick={() => setCondition('CREDITO')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black transition-all ${condition === 'CREDITO' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>CRÉDITO</button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Impuestos (IGV)</label>
                                    <button 
                                        disabled={isReadOnly}
                                        onClick={() => setTaxIncluded(!taxIncluded)}
                                        className={`w-full p-4 border-2 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${taxIncluded ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'} disabled:opacity-70`}
                                    >
                                        {taxIncluded ? <CheckCircle2 className="w-4 h-4"/> : <div className="w-4 h-4 rounded-full border-2"/>}
                                        {taxIncluded ? 'Incluye Impuestos' : '+ Impuestos'}
                                    </button>
                                </div>
                            </div>

                            {/* Detalle de Productos */}
                            <div className="bg-slate-50 rounded-[2rem] p-8 border-2 border-slate-100 space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-black text-slate-800 uppercase tracking-wider text-sm flex items-center gap-2">
                                        <Package className="w-5 h-5 text-emerald-500"/> Artículos en la Orden
                                    </h3>
                                    {!isReadOnly && (
                                        <div className="relative w-96">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                            <input 
                                                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-400 shadow-sm"
                                                placeholder="Añadir productos..."
                                                value={prodSearch}
                                                onChange={e => setProdSearch(e.target.value)}
                                            />
                                            {prodSearch.length > 1 && (
                                                <div className="absolute top-full left-0 w-full bg-white border-2 border-slate-100 mt-2 rounded-2xl shadow-2xl z-[210] overflow-hidden">
                                                    {products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase())).slice(0, 5).map(p => (
                                                        <button key={p.id} onClick={() => addItem(p)} className="w-full text-left p-4 hover:bg-slate-50 text-sm font-bold border-b border-slate-50 last:border-0 flex justify-between items-center group">
                                                            <span>{p.name}</span>
                                                            <span className="text-[10px] font-black text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">+ AGREGAR</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-white rounded-2xl border-2 border-slate-100 overflow-hidden shadow-sm">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-100">
                                            <tr>
                                                <th className="p-5">Producto</th>
                                                <th className="p-5 text-center w-24">Bonif.</th>
                                                <th className="p-5 text-center w-32">Cant.</th>
                                                <th className="p-5 text-right w-40">Costo Unit.</th>
                                                <th className="p-5 text-center w-48">Nvo. P. Venta</th>
                                                <th className="p-5 text-right w-40">Total</th>
                                                {!isReadOnly && <th className="p-5 w-16"></th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-bold text-sm">
                                            {items.length === 0 ? (
                                                <tr><td colSpan={7} className="p-20 text-center text-slate-300 font-black italic uppercase tracking-widest">Añade productos para ver el detalle</td></tr>
                                            ) : items.map(item => {
                                                const margin = item.cost > 0 ? ((item.newSellPrice - item.cost) / item.cost * 100) : 0;
                                                return (
                                                    <tr key={item.id} className={`group hover:bg-slate-50/50 transition-colors ${item.isBonus ? 'bg-emerald-50/30' : ''}`}>
                                                        <td className="p-5">
                                                            <p className="text-slate-800">{item.name}</p>
                                                            {item.isBonus && <span className="text-[9px] font-black text-emerald-600 bg-white border border-emerald-200 px-1.5 rounded uppercase mt-1 inline-block">Bonificación</span>}
                                                        </td>
                                                        <td className="p-5 text-center">
                                                            <button 
                                                                disabled={isReadOnly}
                                                                onClick={() => setItems(prev => prev.map(it => it.id === item.id ? { ...it, isBonus: !it.isBonus } : it))}
                                                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${item.isBonus ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-100 text-slate-300 hover:text-emerald-500'} disabled:opacity-50`}
                                                            >
                                                                <Gift className="w-5 h-5"/>
                                                            </button>
                                                        </td>
                                                        <td className="p-5">
                                                            <input 
                                                                disabled={isReadOnly}
                                                                type="number" 
                                                                className="w-full bg-slate-100 rounded-xl p-3 text-center font-black outline-none focus:ring-4 focus:ring-emerald-100 disabled:bg-white"
                                                                value={item.quantity}
                                                                onChange={e => setItems(prev => prev.map(it => it.id === item.id ? { ...it, quantity: parseFloat(e.target.value) || 0 } : it))}
                                                            />
                                                        </td>
                                                        <td className="p-5">
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">{settings.currency}</span>
                                                                <input 
                                                                    type="number" 
                                                                    disabled={item.isBonus || isReadOnly}
                                                                    className="w-full bg-white border-2 border-slate-100 rounded-xl p-3 pl-8 text-right font-black outline-none focus:border-emerald-400 transition-all disabled:opacity-50 disabled:bg-slate-50"
                                                                    value={item.isBonus ? 0 : item.cost}
                                                                    onChange={e => setItems(prev => prev.map(it => it.id === item.id ? { ...it, cost: parseFloat(e.target.value) || 0 } : it))}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="p-5">
                                                            <div className="space-y-1.5">
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">{settings.currency}</span>
                                                                    <input 
                                                                        type="number" 
                                                                        disabled={isReadOnly}
                                                                        className="w-full bg-indigo-50/50 border-2 border-indigo-100 rounded-xl p-3 pl-8 text-right font-black outline-none focus:border-indigo-500 transition-all disabled:bg-slate-50"
                                                                        value={item.newSellPrice}
                                                                        onChange={e => setItems(prev => prev.map(it => it.id === item.id ? { ...it, newSellPrice: parseFloat(e.target.value) || 0 } : it))}
                                                                    />
                                                                </div>
                                                                <div className={`text-[9px] font-black uppercase text-center px-1 py-0.5 rounded ${margin < 10 ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                                    Gana: {margin.toFixed(1)}%
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-5 text-right font-black text-slate-800">
                                                            {settings.currency}{(item.isBonus ? 0 : item.cost * item.quantity).toFixed(2)}
                                                        </td>
                                                        {!isReadOnly && (
                                                            <td className="p-5 text-center">
                                                                <button onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))} className="text-slate-200 hover:text-rose-500 transition-colors"><Trash2 className="w-5 h-5"/></button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            {/* Pago y Resumen */}
                            <div className="flex flex-col md:flex-row gap-8 justify-between items-start">
                                <div className="w-full md:w-2/5 bg-white border-2 border-slate-100 p-8 rounded-[2rem] space-y-6 shadow-sm">
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2"><CreditCard className="w-5 h-5 text-indigo-500"/> Gestión de Fondos</h4>
                                    
                                    {condition === 'CREDITO' && (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Pago Inicial (Abono)</label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"/>
                                                <input 
                                                    disabled={isReadOnly}
                                                    type="number" 
                                                    className="w-full pl-10 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black outline-none focus:border-indigo-400 text-lg disabled:opacity-70"
                                                    placeholder="0.00"
                                                    value={amountPaid}
                                                    onChange={e => setAmountPaid(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* MÉTODOS DE PAGO */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">¿Cómo pagarás al proveedor?</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { id: 'cash', label: 'Efectivo', icon: Banknote, color: 'emerald' },
                                                { id: 'yape', label: 'Yape', icon: Smartphone, color: 'purple' },
                                                { id: 'plin', label: 'Plin', icon: Zap, color: 'cyan' },
                                                { id: 'transfer', label: 'Banco', icon: BankIcon, color: 'blue' }
                                            ].map((method) => (
                                                <button 
                                                    key={method.id}
                                                    disabled={isReadOnly}
                                                    onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                                                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${paymentMethod === method.id ? `bg-${method.color}-50 border-${method.color}-500 text-${method.color}-700 shadow-md` : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'} disabled:opacity-70`}
                                                >
                                                    <method.icon className={`w-5 h-5 ${paymentMethod === method.id ? `text-${method.color}-600` : 'text-slate-300'}`}/>
                                                    <span className="text-[10px] font-black uppercase">{method.label}</span>
                                                </button>
                                            ))}
                                        </div>

                                        {/* SWITCH ORIGEN CAJA */}
                                        <div className="pt-4 border-t border-slate-100">
                                            <button 
                                                disabled={isReadOnly}
                                                onClick={() => setPayFromCash(!payFromCash)}
                                                className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${payFromCash ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-white border-slate-100 text-slate-400'} disabled:opacity-70`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${payFromCash ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                        <Wallet className="w-4 h-4"/>
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-[10px] font-black uppercase">¿Descontar de Caja?</p>
                                                        <p className="text-[9px] font-bold opacity-60">Afectar el turno actual</p>
                                                    </div>
                                                </div>
                                                <div className={`w-10 h-5 rounded-full relative transition-colors ${payFromCash ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${payFromCash ? 'right-1' : 'left-1'}`}/>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full md:w-1/2 space-y-4 px-8">
                                    <div className="flex justify-between text-slate-400 font-bold text-xs uppercase tracking-widest">
                                        <span>Subtotal Neto</span>
                                        <span>{settings.currency}{totals.subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400 font-bold text-xs uppercase tracking-widest">
                                        <span>Impuestos ({settings.taxRate*100}%)</span>
                                        <span>{settings.currency}{totals.tax.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-8 border-t-2 border-slate-100">
                                        <div className="flex flex-col">
                                            <span className="text-xl font-black text-slate-800 tracking-tight">TOTAL COMPRA</span>
                                            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Cloud Ready</span>
                                        </div>
                                        <span className="text-6xl font-black text-slate-900 tracking-tighter">{settings.currency}{totals.total.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        {!isReadOnly && (
                            <div className="p-8 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50 shrink-0">
                                <div className="flex items-center gap-3 text-slate-400 font-bold text-[10px] uppercase">
                                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                                    <p>Al confirmar, podrás ingresar la mercadería al stock.</p>
                                </div>
                                <div className="flex gap-4 w-full sm:w-auto">
                                    <button 
                                        onClick={() => handleSave('BORRADOR')}
                                        disabled={isSaving}
                                        className="flex-1 sm:flex-none px-8 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-xs hover:bg-slate-100 transition-all uppercase tracking-widest active:scale-95 disabled:opacity-50"
                                    >
                                        Guardar Borrador
                                    </button>
                                    <button 
                                        onClick={() => handleSave('CONFIRMADO')}
                                        disabled={isSaving}
                                        className="flex-1 sm:flex-none px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs shadow-2xl transition-all hover:bg-black flex items-center justify-center gap-3 uppercase tracking-widest active:scale-95 disabled:opacity-50"
                                    >
                                        {isSaving ? <RefreshCw className="w-5 h-5 animate-spin"/> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />} 
                                        {isSaving ? 'Procesando...' : 'Confirmar Pedido'}
                                    </button>
                                </div>
                            </div>
                        )}
                        {isReadOnly && (
                            <div className="p-8 border-t border-slate-100 flex justify-center bg-slate-50/50 shrink-0">
                                <button 
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs transition-all hover:bg-black uppercase tracking-widest"
                                >
                                    Cerrar Vista
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Sub-icon for monetary input
const DollarSign = ({ className }: { className: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
);
