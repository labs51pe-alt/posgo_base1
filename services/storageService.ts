
import { UserProfile, Product, Transaction, Purchase, StoreSettings, Customer, Supplier, CashShift, CashMovement, Lead, Store } from '../types';
import { supabase } from './supabase';

const KEYS = {
  SESSION: 'posgo_session',
  PRODUCTS: 'posgo_products',
  TRANSACTIONS: 'posgo_transactions',
  PURCHASES: 'posgo_purchases',
  SETTINGS: 'posgo_settings',
  CUSTOMERS: 'posgo_customers',
  SUPPLIERS: 'posgo_suppliers',
  SHIFTS: 'posgo_shifts',
  MOVEMENTS: 'posgo_movements',
  ACTIVE_SHIFT_ID: 'posgo_active_shift'
};

const DEMO_TEMPLATE_ID = '00000000-0000-0000-0000-000000000000'; 

const isDemo = () => {
    const session = localStorage.getItem(KEYS.SESSION);
    if (!session) return true;
    try {
        const user = JSON.parse(session);
        return user.id === 'test-user-demo' || user.email?.endsWith('@demo.posgo') || user.role === 'super_admin' || user.id === 'god-mode';
    } catch {
        return true;
    }
};

let cachedStoreId: string | null = null;

const getStoreId = async (): Promise<string> => {
    if (isDemo()) return DEMO_TEMPLATE_ID;
    if (cachedStoreId) return cachedStoreId;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return DEMO_TEMPLATE_ID;

    const { data } = await supabase.from('profiles').select('store_id').eq('id', user.id).single();
    if (data && data.store_id) {
        cachedStoreId = data.store_id;
        return data.store_id;
    }
    return DEMO_TEMPLATE_ID;
};

export const StorageService = {
  saveSession: (user: UserProfile) => {
      localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
      cachedStoreId = null; 
  },
  getSession: (): UserProfile | null => {
    const s = localStorage.getItem(KEYS.SESSION);
    try {
        return s ? JSON.parse(s) : null;
    } catch {
        return null;
    }
  },
  clearSession: async () => {
    localStorage.removeItem(KEYS.SESSION);
    localStorage.removeItem(KEYS.ACTIVE_SHIFT_ID);
    cachedStoreId = null;
    await supabase.auth.signOut();
  },

  // LEADS & STORES
  saveLead: async (lead: Omit<Lead, 'id' | 'created_at'>) => {
      try {
          await supabase.from('leads').upsert({
              name: lead.name,
              business_name: lead.business_name,
              phone: lead.phone,
              status: 'NEW'
          }, { onConflict: 'phone' });
      } catch (e) { console.error(e); }
  },
  getLeads: async (): Promise<Lead[]> => {
      const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      return data || [];
  },
  getAllStores: async (): Promise<Store[]> => {
      const { data } = await supabase.from('stores').select('*').order('created_at', { ascending: false });
      return data || [];
  },

  // PRODUCTS
  getProducts: async (): Promise<Product[]> => {
    const storeId = await getStoreId();
    const { data: productsData } = await supabase.from('products').select('*').eq('store_id', storeId).order('name', { ascending: true });
    
    // Si no hay productos, cargamos la plantilla demo
    if (!productsData || productsData.length === 0) {
        const { data: demoData } = await supabase.from('products').select('*').eq('store_id', DEMO_TEMPLATE_ID).order('name', { ascending: true });
        if (!demoData) return [];
        return demoData.map(p => ({
            ...p, 
            price: Number(p.price), 
            stock: Number(p.stock),
            cost: Number(p.cost || 0),
            variants: Array.isArray(p.variants) ? p.variants : []
        }));
    }

    const { data: imagesData } = await supabase.from('product_images').select('*').eq('store_id', storeId);
    return productsData.map((p: any) => {
        const prodImages = imagesData ? imagesData.filter((img: any) => img.product_id === p.id).map((img: any) => img.image_data) : [];
        return { 
            id: p.id, name: p.name, price: Number(p.price), category: p.category, 
            stock: Number(p.stock), barcode: p.barcode, hasVariants: p.has_variants, 
            variants: Array.isArray(p.variants) ? p.variants : [], images: prodImages, 
            cost: Number(p.cost || 0)
        };
    });
  },
  
  saveProducts: async (products: Product[]) => {
      const storeId = await getStoreId();
      for (const p of products) {
          await supabase.from('products').upsert({ 
              id: p.id, name: p.name, price: p.price, stock: p.stock, 
              category: p.category, barcode: p.barcode, variants: p.variants || [], 
              cost: p.cost || 0, store_id: storeId 
          });
      }
  },

  saveProductWithImages: async (product: Product) => {
      const storeId = await getStoreId();
      await supabase.from('products').upsert({ 
          id: product.id, name: product.name, price: product.price, stock: product.stock, 
          category: product.category, barcode: product.barcode, variants: product.variants || [], 
          cost: product.cost || 0, store_id: storeId 
      });
      if (product.images) {
          await supabase.from('product_images').delete().eq('product_id', product.id).eq('store_id', storeId);
          if (product.images.length > 0) {
              const imageInserts = product.images.map(imgData => ({ product_id: product.id, image_data: imgData, store_id: storeId }));
              await supabase.from('product_images').insert(imageInserts);
          }
      }
  },

  // PURCHASES (CORRECCIÓN CRÍTICA DE COLUMNAS)
  getPurchases: async (): Promise<Purchase[]> => {
    const storeId = await getStoreId();
    const { data, error } = await supabase.from('purchases')
        .select('*')
        .eq('store_id', storeId)
        .order('date', { ascending: false });
    
    if (error) {
        console.error("Error getPurchases:", error);
        return [];
    }

    return (data || []).map((p: any) => ({ 
        id: p.id,
        date: p.date,
        supplierId: p.supplier_id || p.supplierId, // Soporte para ambos nombres
        invoiceNumber: p.invoice_number || p.invoiceNumber,
        total: Number(p.total || 0),
        amountPaid: Number(p.amount_paid || p.amountPaid || 0),
        items: typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || []),
        status: p.status,
        received: p.received || 'NO'
    }));
  },

  savePurchase: async (p: Purchase) => {
    const storeId = await getStoreId();
    // Mapeamos explícitamente a nombres de columna snake_case para la base de datos
    const { error } = await supabase.from('purchases').insert({ 
        id: p.id, 
        date: p.date, 
        supplier_id: p.supplierId, 
        invoice_number: p.invoiceNumber,
        total: p.total, 
        amount_paid: p.amountPaid, 
        items: p.items, 
        status: p.status,
        received: p.received || 'NO', 
        store_id: storeId 
    });
    if (error) throw error;
  },

  updatePurchase: async (p: Purchase) => {
    const storeId = await getStoreId();
    const { error } = await supabase.from('purchases').update({ 
        status: p.status, 
        received: p.received,
        amount_paid: p.amountPaid 
    }).eq('id', p.id).eq('store_id', storeId);
    if (error) throw error;
  },

  confirmReceptionAndSyncStock: async (purchase: Purchase) => {
      const storeId = await getStoreId();
      if (purchase.received === 'YES') return;

      // 1. Actualizar stock de cada producto en la nube
      for (const item of purchase.items) {
          const { data: product } = await supabase.from('products')
            .select('stock')
            .eq('id', item.productId)
            .eq('store_id', storeId)
            .single();
          
          if (product) {
              const currentStock = Number(product.stock || 0);
              const qtyToAdd = Number(item.quantity || 0);
              await supabase.from('products')
                .update({ stock: currentStock + qtyToAdd })
                .eq('id', item.productId)
                .eq('store_id', storeId);
          }
      }

      // 2. Marcar compra como recibida en la nube
      const { error } = await supabase.from('purchases')
        .update({ received: 'YES' })
        .eq('id', purchase.id)
        .eq('store_id', storeId);
      if (error) throw error;
  },

  // TRANSACTIONS
  getTransactions: async (): Promise<Transaction[]> => {
    const storeId = await getStoreId();
    const { data } = await supabase.from('transactions').select('*').eq('store_id', storeId).order('date', { ascending: false });
    return (data || []).map((t: any) => ({ 
        ...t, 
        items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items, 
        payments: typeof t.payments === 'string' ? JSON.parse(t.payments) : t.payments 
    }));
  },

  saveTransaction: async (t: Transaction) => {
    const storeId = await getStoreId();
    await supabase.from('transactions').insert({ ...t, store_id: storeId });
  },

  // CASH CONTROL
  getShifts: async (): Promise<CashShift[]> => {
    const storeId = await getStoreId();
    const { data } = await supabase.from('shifts').select('*').eq('store_id', storeId).order('startTime', { ascending: false });
    return data || [];
  },

  saveShift: async (s: CashShift) => {
    const storeId = await getStoreId();
    await supabase.from('shifts').upsert({ ...s, store_id: storeId });
  },

  getMovements: async (): Promise<CashMovement[]> => {
    const storeId = await getStoreId();
    const { data } = await supabase.from('movements').select('*').eq('store_id', storeId).order('timestamp', { ascending: false });
    return data || [];
  },

  saveMovement: async (m: CashMovement) => {
    const storeId = await getStoreId();
    await supabase.from('movements').insert({ ...m, store_id: storeId });
  },

  // SETTINGS & OTHER
  // Added missing getCustomers method to resolve reference errors
  getCustomers: async (): Promise<Customer[]> => {
    const storeId = await getStoreId();
    const { data } = await supabase.from('customers').select('*').eq('store_id', storeId);
    return data || [];
  },

  getSuppliers: async (): Promise<Supplier[]> => {
    const storeId = await getStoreId();
    const { data } = await supabase.from('suppliers').select('*').eq('store_id', storeId);
    return data || [];
  },

  saveSupplier: async (s: Supplier) => {
    const storeId = await getStoreId();
    await supabase.from('suppliers').upsert({ ...s, store_id: storeId });
  },

  getSettings: async (): Promise<StoreSettings> => {
    const storeId = await getStoreId();
    const { data } = await supabase.from('stores').select('settings').eq('id', storeId).single();
    return data?.settings || { name: 'Mi Bodega', currency: 'S/', taxRate: 0.18, pricesIncludeTax: true };
  },

  saveSettings: async (settings: StoreSettings) => {
    const storeId = await getStoreId();
    await supabase.from('stores').update({ settings }).eq('id', storeId);
  },

  getActiveShiftId: (): string | null => localStorage.getItem(KEYS.ACTIVE_SHIFT_ID),
  setActiveShiftId: (id: string | null) => {
    if (id) localStorage.setItem(KEYS.ACTIVE_SHIFT_ID, id);
    else localStorage.removeItem(KEYS.ACTIVE_SHIFT_ID);
  },

  resetDemoData: async () => {
      localStorage.removeItem(KEYS.ACTIVE_SHIFT_ID);
      cachedStoreId = null;
  },

  getDemoTemplate: async (force = false): Promise<Product[]> => {
    const { data: productsData } = await supabase.from('products').select('*').eq('store_id', DEMO_TEMPLATE_ID).order('name', { ascending: true });
    if (!productsData) return [];
    return productsData.map((p: any) => ({
        id: p.id, name: p.name, price: Number(p.price), category: p.category, 
        stock: Number(p.stock), barcode: p.barcode, hasVariants: p.has_variants, 
        variants: Array.isArray(p.variants) ? p.variants : [], images: [], cost: Number(p.cost || 0)
    }));
  },

  saveDemoProductToTemplate: async (product: Product) => {
      try {
          const { error } = await supabase.from('products').upsert({ 
              id: product.id, name: product.name, price: product.price, stock: product.stock, 
              category: product.category, barcode: product.barcode, variants: product.variants || [], 
              cost: product.cost || 0, store_id: DEMO_TEMPLATE_ID 
          });
          return { success: !error, error: error };
      } catch (error: any) {
          return { success: false, error: error };
      }
  },

  deleteDemoProduct: async (productId: string) => {
      const storeId = await getStoreId();
      await supabase.from('product_images').delete().eq('product_id', productId).eq('store_id', storeId);
      await supabase.from('products').delete().eq('id', productId).eq('store_id', storeId);
  }
};
