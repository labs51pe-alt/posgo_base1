
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

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return DEMO_TEMPLATE_ID;

        const { data, error } = await supabase.from('profiles').select('store_id').eq('id', user.id).maybeSingle();
        if (data && data.store_id) {
            cachedStoreId = data.store_id;
            return data.store_id;
        }
    } catch (e) {
        console.warn("Could not fetch store_id from profiles, defaulting to demo", e);
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
    
    if (!productsData || productsData.length === 0) {
        return await StorageService.getDemoTemplate();
    }

    const { data: imagesData } = await supabase.from('product_images').select('*').eq('store_id', storeId);
    return productsData.map((p: any) => {
        const prodImages = imagesData ? imagesData.filter((img: any) => img.product_id === p.id).map((img: any) => img.image_data) : [];
        return { 
            id: p.id, name: p.name, price: Number(p.price), category: p.category, 
            stock: Number(p.stock), barcode: p.barcode, 
            hasVariants: p.has_variants, 
            variants: Array.isArray(p.variants) ? p.variants : [], 
            images: prodImages, 
            cost: Number(p.cost || 0), 
            isPack: p.is_pack, 
            packItems: Array.isArray(p.pack_items) ? p.pack_items : []
        };
    });
  },
  
  saveProducts: async (products: Product[]) => {
      const storeId = await getStoreId();
      for (const p of products) {
          const { error } = await supabase.from('products').upsert({ 
              id: p.id, name: p.name, price: p.price, stock: p.stock, 
              category: p.category, barcode: p.barcode, variants: p.variants || [], 
              cost: p.cost || 0, store_id: storeId, has_variants: p.hasVariants,
              is_pack: p.isPack, pack_items: p.packItems || []
          });
          if (error) throw new Error(error.message || "Error al guardar productos");
      }
  },

  saveProductWithImages: async (product: Product) => {
      const storeId = await getStoreId();
      const { error: prodError } = await supabase.from('products').upsert({ 
          id: product.id, name: product.name, price: product.price, stock: product.stock, 
          category: product.category, barcode: product.barcode, variants: product.variants || [], 
          cost: product.cost || 0, store_id: storeId, has_variants: product.hasVariants,
          is_pack: product.isPack, pack_items: product.packItems || []
      });
      if (prodError) throw new Error(prodError.message || "Error de base de datos");

      if (product.images) {
          await supabase.from('product_images').delete().eq('product_id', product.id).eq('store_id', storeId);
          if (product.images.length > 0) {
              const imageInserts = product.images.map(imgData => ({ product_id: product.id, image_data: imgData, store_id: storeId }));
              const { error: imgError } = await supabase.from('product_images').insert(imageInserts);
              if (imgError) throw new Error(imgError.message || "Error al guardar imágenes");
          }
      }
  },

  // PURCHASES - Mapeo Cloud Mejorado
  getPurchases: async (): Promise<Purchase[]> => {
    const storeId = await getStoreId();
    const { data, error } = await supabase.from('purchases')
        .select('*')
        .eq('store_id', storeId)
        .order('date', { ascending: false });
    
    if (error) {
        console.error("Error fetching purchases:", error);
        return [];
    }

    return (data || []).map((p: any) => ({ 
        id: p.id,
        reference: p.reference || `P${p.id.slice(0,4).toUpperCase()}`,
        date: p.date,
        supplierId: p.supplier_id, // snake to camel
        invoiceNumber: p.invoice_number,
        subtotal: Number(p.subtotal || 0),
        tax: Number(p.tax || 0),
        total: Number(p.total || 0),
        amountPaid: Number(p.amount_paid || 0),
        paymentMethod: p.payment_method || 'cash',
        paymentCondition: p.payment_condition || 'CONTADO',
        payFromCash: !!p.pay_from_cash,
        taxIncluded: !!p.tax_included,
        items: typeof p.items === 'string' ? JSON.parse(p.items) : (p.items || []),
        status: p.status,
        received: p.received || 'NO'
    }));
  },

  savePurchase: async (p: Purchase) => {
    const storeId = await getStoreId();
    
    // Traducir camelCase a snake_case para Supabase
    const dbPayload = {
        id: p.id,
        reference: p.reference,
        date: p.date,
        supplier_id: p.supplierId,
        invoice_number: p.invoiceNumber,
        subtotal: p.subtotal,
        tax: p.tax,
        total: p.total,
        amount_paid: p.amountPaid,
        pay_from_cash: p.payFromCash,
        payment_condition: p.paymentCondition,
        tax_included: p.taxIncluded,
        items: JSON.stringify(p.items),
        status: p.status,
        received: p.received,
        store_id: storeId
    };

    const { error } = await supabase.from('purchases').upsert(dbPayload);
    if (error) throw new Error(error.message);
  },

  confirmReceptionAndSyncStock: async (purchase: Purchase) => {
      const storeId = await getStoreId();
      if (purchase.received === 'YES') return;

      for (const item of purchase.items) {
          const { data: product } = await supabase.from('products')
            .select('*')
            .eq('id', item.productId)
            .eq('store_id', storeId)
            .single();
          
          if (product) {
              const currentStock = Number(product.stock || 0);
              const qtyToAdd = Number(item.quantity || 0);
              
              // Lógica de costo: Si es bonificación no altera el costo promedio del sistema
              const newCost = item.isBonus ? Number(product.cost || 0) : Number(item.cost || 0);
              
              // Lógica de precio: Si el usuario definió un nuevo precio en la compra, lo aplicamos a la nube
              const newPrice = (item.newSellPrice && item.newSellPrice > 0) ? item.newSellPrice : Number(product.price || 0);
              
              await supabase.from('products')
                .update({ 
                    stock: currentStock + qtyToAdd,
                    cost: newCost,
                    price: newPrice
                })
                .eq('id', item.productId)
                .eq('store_id', storeId);
          }
      }

      const { error } = await supabase.from('purchases')
        .update({ received: 'YES', status: 'RECIBIDO' })
        .eq('id', purchase.id)
        .eq('store_id', storeId);
      
      if (error) throw new Error(error.message);
  },

  revertReceptionAndSyncStock: async (purchase: Purchase) => {
      const storeId = await getStoreId();
      if (purchase.received === 'NO') return;

      for (const item of purchase.items) {
          const { data: product } = await supabase.from('products')
            .select('stock')
            .eq('id', item.productId)
            .eq('store_id', storeId)
            .single();
          
          if (product) {
              const currentStock = Number(product.stock || 0);
              const qtyToSub = Number(item.quantity || 0);
              
              await supabase.from('products')
                .update({ 
                    stock: Math.max(0, currentStock - qtyToSub) 
                })
                .eq('id', item.productId)
                .eq('store_id', storeId);
          }
      }

      const { error } = await supabase.from('purchases')
        .update({ received: 'NO', status: 'CONFIRMADO' })
        .eq('id', purchase.id)
        .eq('store_id', storeId);
      
      if (error) throw new Error(error.message);
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
    const { error } = await supabase.from('transactions').insert({ ...t, store_id: storeId });
    if (error) throw new Error(error.message || "Error al guardar venta");
  },

  // CASH CONTROL
  getShifts: async (): Promise<CashShift[]> => {
    const storeId = await getStoreId();
    const { data } = await supabase.from('shifts').select('*').eq('store_id', storeId).order('startTime', { ascending: false });
    return data || [];
  },

  saveShift: async (s: CashShift) => {
    const storeId = await getStoreId();
    const { error } = await supabase.from('shifts').upsert({ ...s, store_id: storeId });
    if (error) throw new Error(error.message || "Error al guardar turno");
  },

  getMovements: async (): Promise<CashMovement[]> => {
    const storeId = await getStoreId();
    const { data } = await supabase.from('movements').select('*').eq('store_id', storeId).order('timestamp', { ascending: false });
    return data || [];
  },

  saveMovement: async (m: CashMovement) => {
    const storeId = await getStoreId();
    const { error } = await supabase.from('movements').insert({ ...m, store_id: storeId });
    if (error) throw new Error(error.message || "Error al guardar movimiento");
  },

  // SETTINGS & OTHER
  getCustomers: async (): Promise<Customer[]> => {
    const storeId = await getStoreId();
    const { data } = await supabase.from('customers').select('*').eq('store_id', storeId);
    return data || [];
  },

  getSuppliers: async (): Promise<Supplier[]> => {
    const storeId = await getStoreId();
    const { data } = await supabase.from('suppliers').select('*').eq('store_id', storeId).order('name', { ascending: true });
    return data || [];
  },

  saveSupplier: async (s: Supplier) => {
    const storeId = await getStoreId();
    const { error } = await supabase.from('suppliers').upsert({ ...s, store_id: storeId });
    if (error) throw new Error(error.message || "Error al guardar proveedor");
  },

  getSettings: async (): Promise<StoreSettings> => {
    const storeId = await getStoreId();
    const { data: storeData } = await supabase.from('stores').select('settings').eq('id', storeId).maybeSingle();
    return storeData?.settings || { name: 'Mi Bodega', currency: 'S/', taxRate: 0.18, pricesIncludeTax: true };
  },

  saveSettings: async (settings: StoreSettings) => {
    const storeId = await getStoreId();
    const { error } = await supabase.from('stores').update({ settings }).eq('id', storeId);
    if (error) throw new Error(error.message || "Error al guardar configuración");
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
    
    const { data: imagesData } = await supabase.from('product_images').select('*').eq('store_id', DEMO_TEMPLATE_ID);
    
    return productsData.map((p: any) => {
        const prodImages = imagesData ? imagesData.filter((img: any) => img.product_id === p.id).map((img: any) => img.image_data) : [];
        return {
            id: p.id, name: p.name, price: Number(p.price), category: p.category, 
            stock: Number(p.stock), barcode: p.barcode, 
            hasVariants: p.has_variants, 
            variants: Array.isArray(p.variants) ? p.variants : [], 
            images: prodImages, 
            cost: Number(p.cost || 0),
            isPack: p.is_pack,
            packItems: Array.isArray(p.pack_items) ? p.pack_items : []
        };
    });
  },

  saveDemoProductToTemplate: async (product: Product) => {
      try {
          const { error } = await supabase.from('products').upsert({ 
              id: product.id, name: product.name, price: product.price, stock: product.stock, 
              category: product.category, barcode: product.barcode, variants: product.variants || [], 
              cost: product.cost || 0, store_id: DEMO_TEMPLATE_ID,
              has_variants: product.hasVariants,
              is_pack: product.isPack,
              pack_items: product.packItems || []
          });

          if (!error && product.images) {
              await supabase.from('product_images').delete().eq('product_id', product.id).eq('store_id', DEMO_TEMPLATE_ID);
              if (product.images.length > 0) {
                  const imageInserts = product.images.map(imgData => ({ 
                      product_id: product.id, 
                      image_data: imgData, 
                      store_id: DEMO_TEMPLATE_ID 
                  }));
                  await supabase.from('product_images').insert(imageInserts);
              }
          }
          return { success: !error, error: error };
      } catch (error: any) {
          return { success: false, error: error };
      }
  },

  deleteDemoProduct: async (productId: string) => {
      await supabase.from('product_images').delete().eq('product_id', productId).eq('store_id', DEMO_TEMPLATE_ID);
      await supabase.from('products').delete().eq('id', productId).eq('store_id', DEMO_TEMPLATE_ID);
  }
};
