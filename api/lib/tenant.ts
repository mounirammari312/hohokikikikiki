import { getTenantsCollection } from './models';

export async function resolveTenantFromHost(host: string) {
  try {
    const tenants = await getTenantsCollection();
    const cleanHost = host.split(':')[0].toLowerCase();
    
    // Check custom domain
    const tenantByDomain = await tenants.findOne({ customDomain: cleanHost });
    if (tenantByDomain) return tenantByDomain;

    // Check subdomain (e.g. store1.amugar.com)
    const subdomain = cleanHost.split('.')[0];
    const tenantBySubdomain = await tenants.findOne({ slug: subdomain });
    return tenantBySubdomain || null;
  } catch (error) {
    console.error('Tenant resolution error:', error);
    return null;
  }
}
