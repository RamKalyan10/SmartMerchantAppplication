import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';

export const DEFAULT_STORE_ID = 'store_dwdm_001';

// ==========================================
// 1. USERS & PROFILES
// ==========================================
export async function getUserProfile(uid) {
  const docRef = doc(db, 'users', uid);
  const snap = await getDoc(docRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function upsertUserProfile(uid, userData) {
  const docRef = doc(db, 'users', uid);
  const payload = {
    ...userData,
    updatedAt: new Date().toISOString()
  };
  await setDoc(docRef, payload, { merge: true });
  return { id: uid, ...payload };
}

// ==========================================
// 2. PRODUCTS & INVENTORY
// ==========================================
export async function getProducts(storeId = DEFAULT_STORE_ID) {
  try {
    const q = query(collection(db, 'products'), where('storeId', '==', storeId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Firestore getProducts error:', err);
    return [];
  }
}

export async function addProduct(productData, storeId = DEFAULT_STORE_ID) {
  const docRef = await addDoc(collection(db, 'products'), {
    ...productData,
    storeId,
    cost_price: Number(productData.cost_price || 0),
    selling_price: Number(productData.selling_price || 0),
    stock_quantity: Number(productData.stock_quantity || 0),
    min_stock_level: Number(productData.min_stock_level || 10),
    createdAt: new Date().toISOString()
  });
  return { id: docRef.id, ...productData };
}

export async function updateProduct(productId, updates) {
  const docRef = doc(db, 'products', productId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
  return { id: productId, ...updates };
}

export async function deleteProduct(productId) {
  await deleteDoc(doc(db, 'products', productId));
  return true;
}

// ==========================================
// 3. CATEGORIES & SUPPLIERS
// ==========================================
export async function getCategories(storeId = DEFAULT_STORE_ID) {
  const q = query(collection(db, 'categories'), where('storeId', '==', storeId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addCategory(categoryData, storeId = DEFAULT_STORE_ID) {
  const docRef = await addDoc(collection(db, 'categories'), {
    ...categoryData,
    storeId,
    createdAt: new Date().toISOString()
  });
  return { id: docRef.id, ...categoryData };
}

export async function getSuppliers(storeId = DEFAULT_STORE_ID) {
  const q = query(collection(db, 'suppliers'), where('storeId', '==', storeId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addSupplier(supplierData, storeId = DEFAULT_STORE_ID) {
  const docRef = await addDoc(collection(db, 'suppliers'), {
    ...supplierData,
    storeId,
    createdAt: new Date().toISOString()
  });
  return { id: docRef.id, ...supplierData };
}

// ==========================================
// 4. CUSTOMERS & KHATA
// ==========================================
export async function getCustomers(storeId = DEFAULT_STORE_ID) {
  const q = query(collection(db, 'customers'), where('storeId', '==', storeId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addCustomer(customerData, storeId = DEFAULT_STORE_ID) {
  const docRef = await addDoc(collection(db, 'customers'), {
    ...customerData,
    storeId,
    total_spent: Number(customerData.total_spent || 0),
    pending_amount: Number(customerData.pending_amount || 0),
    orders_count: Number(customerData.orders_count || 0),
    createdAt: new Date().toISOString()
  });
  return { id: docRef.id, ...customerData };
}

// ==========================================
// 5. INVOICES & ATOMIC STOCK TRANSACTION
// ==========================================
export async function createInvoice(invoiceData, storeId = DEFAULT_STORE_ID) {
  return await runTransaction(db, async (transaction) => {
    // 1. Verify and decrement stock atomically
    const items = invoiceData.items || [];
    for (const item of items) {
      if (item.product_id) {
        const prodRef = doc(db, 'products', item.product_id);
        const prodSnap = await transaction.get(prodRef);
        if (prodSnap.exists()) {
          const currentQty = Number(prodSnap.data().stock_quantity || 0);
          const newQty = Math.max(0, currentQty - Number(item.quantity || 1));
          transaction.update(prodRef, { stock_quantity: newQty });
        }
      }
    }

    // 2. Update customer balance if applicable
    if (invoiceData.customer_id) {
      const custRef = doc(db, 'customers', invoiceData.customer_id);
      const custSnap = await transaction.get(custRef);
      if (custSnap.exists()) {
        const isPaid = (invoiceData.payment_status || 'PAID').toUpperCase() === 'PAID';
        const totalAmt = Number(invoiceData.total_amount || 0);
        const prevSpent = Number(custSnap.data().total_spent || 0);
        const prevPending = Number(custSnap.data().pending_amount || 0);
        const prevOrders = Number(custSnap.data().orders_count || 0);

        transaction.update(custRef, {
          total_spent: isPaid ? prevSpent + totalAmt : prevSpent,
          pending_amount: !isPaid ? prevPending + totalAmt : prevPending,
          orders_count: prevOrders + 1
        });
      }
    }

    // 3. Create the invoice document
    const invoiceRef = doc(collection(db, 'invoices'));
    const finalInvoice = {
      ...invoiceData,
      id: invoiceRef.id,
      storeId,
      date: invoiceData.date || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };
    transaction.set(invoiceRef, finalInvoice);

    return finalInvoice;
  });
}

export async function getInvoices(storeId = DEFAULT_STORE_ID) {
  const q = query(
    collection(db, 'invoices'),
    where('storeId', '==', storeId),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ==========================================
// 6. EXPENSES
// ==========================================
export async function getExpenses(storeId = DEFAULT_STORE_ID) {
  const q = query(
    collection(db, 'expenses'),
    where('storeId', '==', storeId),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addExpense(expenseData, storeId = DEFAULT_STORE_ID) {
  const docRef = await addDoc(collection(db, 'expenses'), {
    ...expenseData,
    storeId,
    amount: Number(expenseData.amount || 0),
    date: expenseData.date || new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  });
  return { id: docRef.id, ...expenseData };
}

export async function deleteExpense(expenseId) {
  await deleteDoc(doc(db, 'expenses', expenseId));
  return true;
}

// ==========================================
// 7. SEEDING / BULK SYNC (Helper)
// ==========================================
export async function seedInitialFirestoreData(catalogData, storeId = DEFAULT_STORE_ID) {
  const existingProds = await getProducts(storeId);
  if (existingProds.length > 0) {
    console.log(`Firestore already populated with ${existingProds.length} products.`);
    return { skipped: true, count: existingProds.length };
  }

  const batch = writeBatch(db);
  let count = 0;

  // Seed categories
  if (catalogData.categories) {
    for (const c of catalogData.categories) {
      const ref = doc(db, 'categories', c.id);
      batch.set(ref, { ...c, storeId });
      count++;
    }
  }

  // Seed suppliers
  if (catalogData.suppliers) {
    for (const s of catalogData.suppliers) {
      const ref = doc(db, 'suppliers', s.id);
      batch.set(ref, { ...s, storeId });
      count++;
    }
  }

  // Seed products
  if (catalogData.products) {
    for (const p of catalogData.products) {
      const ref = doc(db, 'products', p.id);
      batch.set(ref, { ...p, storeId });
      count++;
    }
  }

  // Seed customers
  if (catalogData.customers) {
    for (const cu of catalogData.customers) {
      const ref = doc(db, 'customers', cu.id);
      batch.set(ref, { ...cu, storeId });
      count++;
    }
  }

  await batch.commit();
  console.log(`Successfully seeded ${count} initial records to Cloud Firestore.`);
  return { success: true, count };
}
