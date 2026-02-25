import { ReactNode } from 'react';
import { getTenantConfig } from '@/lib/services/tenant.service';

export default async function TenantLayout({ children, params }: { children: ReactNode; params: { tenant: string } }) {
  // Server-side tenant resolution
  const tenantConfig = await getTenantConfig(params.tenant);
  if (!tenantConfig) {
    // Optionally redirect or show error
    return <div className="min-h-screen flex items-center justify-center text-red-600">Invalid tenant</div>;
  }

  // Inject tenant context (could use React Context or props)
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Example: Tenant header */}
      <header className="bg-primary-600 text-white p-4">
        <h1 className="text-xl font-bold">{tenantConfig.name} Workspace</h1>
      </header>
      {/* Main content */}
      <main className="p-8">
        {children}
      </main>
    </div>
  );
}
