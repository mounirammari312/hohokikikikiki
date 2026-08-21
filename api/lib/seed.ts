import { getProductsCollection, getTenantsCollection } from './models';

export async function seedInitialData() {
  try {
    const tenants = await getTenantsCollection();
    const count = await tenants.countDocuments();
    if (count === 0) {
      await tenants.insertOne({
        id: 'amugar-main',
        name: 'Amugar Main Store',
        slug: 'main',
        currency: 'DZD',
        createdAt: new Date()
      });
    }
  } catch (e) {
    console.error('Seed error:', e);
  }
}
