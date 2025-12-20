
import React, { useState, useEffect } from 'react';
import { Lead, Store, Product } from '../types';
import { StorageService } from '../services/storageService';
import { Users, Building2, Trash2, RefreshCw, ShieldAlert, Package, Plus, Edit, X, ImageIcon, Terminal, Layers, Zap, Wallet } from 'lucide-react';

interface SuperAdminProps {
    onEditProduct?: (product: Product) => void;
    onNewProduct?: () => void;
    lastUpdated?: number;
}

export const SuperAdminView: React.FC<SuperAdminProps> = ({ onEditProduct, onNewProduct, lastUpdated }) => {
    const [activeTab, setActiveTab] = useState<'LEADS' | 'STORES' | 'DEMO_PRODUCTS'>('DEMO_PRODUCTS'); 
    const [leads, setLeads] = useState<Lead[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [demoProducts, setDemoProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSqlHelp, setShowSqlHelp] = useState(false);

    const fetchData = async (force = false) => {
        setLoading(true);
        try {
            const [l, s, demo] = await Promise.all([
                StorageService.getLeads(),
                StorageService.getAllStores(),
                StorageService.getDemoTemplate(force) 
            ]);
            setLeads(l);
            setStores(s);
            setDemoProducts(demo);
        } catch (error) {
            console.error("Error fetching admin data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [lastUpdated]);

    const handleDeleteDemoProduct = async (id: string) => {
        if (window.confirm('¿Eliminar producto de la plantilla demo en la nube?')) {
            await StorageService.deleteDemoProduct(id);
            fetchData(true);
        }
    };

    const SQL_CODE = `-- 1. ASEGURAR TABLAS BASE
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    store_id uuid DEFAULT '00000000-0000-0000-0000-000000000000',
    full_name text,
    role text DEFAULT 'admin'
);

-- 2. REPARACIÓN INTEGRAL DE LA TABLA PURCHASES
-- Este script agrega todas las columnas que el StorageService requiere.

ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS date timestamptz DEFAULT now();
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS supplier_id uuid;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS tax numeric DEFAULT 0;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS total numeric DEFAULT 0;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS pay_from_cash boolean DEFAULT false;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS tax_included boolean DEFAULT true;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'cash';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS payment_condition text DEFAULT 'CONTADO';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS status text DEFAULT 'BORRADOR';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS received text DEFAULT 'NO';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS store_id uuid DEFAULT '00000000-0000-0000-0000-000000000000';

-- 3. CORRECCIÓN DE NOMBRES SI EXISTEN EN CAMELCASE (MIGRACIÓN)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='payFromCash') THEN
        ALTER TABLE public.purchases RENAME COLUMN "payFromCash" TO pay_from_cash;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='supplierId') THEN
        ALTER TABLE public.purchases RENAME COLUMN "supplierId" TO supplier_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='invoiceNumber') THEN
        ALTER TABLE public.purchases RENAME COLUMN "invoiceNumber" TO invoice_number;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='amountPaid') THEN
        ALTER TABLE public.purchases RENAME COLUMN "amountPaid" TO amount_paid;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='taxIncluded') THEN
        ALTER TABLE public.purchases RENAME COLUMN "taxIncluded" TO tax_included;
    END IF;
END $$;

-- 4. RE-CONFIGURAR SEGURIDAD (RLS)
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own store purchases" ON public.purchases;

CREATE POLICY "Users can manage their own store purchases" ON public.purchases
    FOR ALL
    TO authenticated
    USING (
        store_id = '00000000-0000-0000-0000-000000000000' OR
        store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
    )
    WITH CHECK (
        store_id = '00000000-0000-0000-0000-000000000000' OR
        store_id IN (SELECT store_id FROM public.profiles WHERE id = auth.uid())
    );

-- 5. RECARGAR ESQUEMA PARA POSTGREST
NOTIFY pgrst, 'reload schema';`;

    return (
        <div className="p-8 h-full bg-[#f8fafc] flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <ShieldAlert className="w-8 h-8 text-red-600"/> Super Admin
                    </h1>
                    <p className="text-slate-500 font-medium">Gestión Avanzada Cloud</p>
                </div>
                <button onClick={() => fetchData(true)} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm group">
                    <RefreshCw className={`w-5 h-5 text-slate-500 group-hover:text-indigo-600 ${loading ? 'animate-spin' : ''}`}/>
                </button>
            </div>

            <div className="flex flex-wrap gap-4 mb-6">
                <button onClick={() => setActiveTab('LEADS')} className={`px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'LEADS' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}><Users className="w-4 h-4"/> Leads</button>
                <button onClick={() => setActiveTab('STORES')} className={`px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'STORES' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}><Building2 className="w-4 h-4"/> Tiendas</button>
                <button onClick={() => setActiveTab('DEMO_PRODUCTS')} className={`px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'DEMO_PRODUCTS' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400'}`}><Package className="w-4 h-4"/> Plantilla Cloud</button>
            </div>

            <div className="flex-1 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                {activeTab === 'DEMO_PRODUCTS' && (
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-amber-600">
                             <ImageIcon className="w-4 h-4"/>
                             <span className="text-xs font-bold uppercase tracking-wider">Productos Globales</span>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setShowSqlHelp(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-black"><Terminal className="w-4 h-4"/> REPARAR DB (SQL)</button>
                             <button onClick={onNewProduct} className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-emerald-600"><Plus className="w-4 h-4"/> Nuevo Global</button>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-400 sticky top-0 z-10">
                            <tr>
                                {activeTab === 'DEMO_PRODUCTS' && (
                                    <>
                                        <th className="p-6">Img</th>
                                        <th className="p-6">Nombre del Producto</th>
                                        <th className="p-6">Categoría / Tipo</th>
                                        <th className="p-6 text-right">Precio</th>
                                        <th className="p-6 text-right">Acciones</th>
                                    </>
                                )}
                                {activeTab === 'LEADS' && (
                                    <>
                                        <th className="p-6">Nombre</th>
                                        <th className="p-6">Negocio</th>
                                        <th className="p-6">Teléfono</th>
                                        <th className="p-6">Fecha</th>
                                        <th className="p-6">Status</th>
                                    </>
                                )}
                                {activeTab === 'STORES' && (
                                    <>
                                        <th className="p-6">Store ID</th>
                                        <th className="p-6">Nombre</th>
                                        <th className="p-6">Creada</th>
                                        <th className="p-6">Status</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {activeTab === 'DEMO_PRODUCTS' && demoProducts.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50/50 group">
                                    <td className="p-6">
                                        {p.images && p.images.length > 0 ? (
                                            <img src={p.images[0]} className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm" alt=""/>
                                        ) : (
                                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300 font-bold text-xs italic">N/A</div>
                                        )}
                                    </td>
                                    <td className="p-6 font-bold text-slate-800">{p.name}</td>
                                    <td className="p-6">
                                        <div className="flex flex-wrap gap-2">
                                            <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded-md font-bold uppercase">{p.category}</span>
                                            {p.hasVariants && (
                                                <span className="bg-indigo-50 text-indigo-600 text-[10px] px-2 py-1 rounded-md font-bold uppercase flex items-center gap-1">
                                                    <Layers className="w-3 h-3"/> Variantes
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-6 text-right font-black text-slate-700">S/{p.price.toFixed(2)}</td>
                                    <td className="p-6 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => onEditProduct && onEditProduct(p)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit className="w-4 h-4"/></button>
                                            <button onClick={() => handleDeleteDemoProduct(p.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {activeTab === 'LEADS' && leads.map((l) => (
                                <tr key={l.id} className="hover:bg-slate-50/50">
                                    <td className="p-6 font-bold text-slate-800">{l.name}</td>
                                    <td className="p-6 font-medium text-slate-600">{l.business_name}</td>
                                    <td className="p-6 font-mono text-emerald-600">+{l.phone}</td>
                                    <td className="p-6 text-xs text-slate-400">{new Date(l.created_at).toLocaleDateString()}</td>
                                    <td className="p-6"><span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black">{l.status || 'NEW'}</span></td>
                                </tr>
                            ))}
                            {activeTab === 'STORES' && stores.map((s) => (
                                <tr key={s.id} className="hover:bg-slate-50/50">
                                    <td className="p-6 font-mono text-[10px] text-slate-400">{s.id}</td>
                                    <td className="p-6 font-bold text-slate-800">{s.settings?.name || 'Store'}</td>
                                    <td className="p-6 text-xs text-slate-400">{new Date(s.created_at).toLocaleDateString()}</td>
                                    <td className="p-6"><span className="px-2 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">ACTIVE</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showSqlHelp && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-6 shadow-2xl animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                             <h3 className="font-black text-xl text-slate-800 flex items-center gap-2"><Terminal className="w-6 h-6 text-indigo-500"/> Reparar Base de Datos</h3>
                             <button onClick={() => setShowSqlHelp(false)}><X className="w-6 h-6"/></button>
                        </div>
                        <p className="text-sm text-slate-600 mb-4 font-bold">Copia este código y pégalo en el SQL Editor de Supabase:</p>
                        <pre className="bg-slate-900 text-emerald-400 p-6 rounded-2xl text-[11px] overflow-x-auto mb-6 custom-scrollbar leading-relaxed font-mono">{SQL_CODE}</pre>
                        <div className="flex gap-4">
                             <button onClick={() => setShowSqlHelp(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase">Cerrar</button>
                             <button onClick={() => { navigator.clipboard.writeText(SQL_CODE); alert("¡Código Copiado! Ve a Supabase, pégalo en el SQL Editor y presiona RUN."); }} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all active:scale-95 uppercase tracking-widest text-xs">Copiar Código SQL</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
