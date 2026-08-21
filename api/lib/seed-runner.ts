import { seedInitialData } from './seed';

seedInitialData()
  .then(() => console.log('Seed completed successfully'))
  .catch((err) => console.error('Seed runner failed:', err));
