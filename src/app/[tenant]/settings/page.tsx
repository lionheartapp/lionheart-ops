import { getSettingsForTenant } from '@/lib/services/settings.service';

export default async function Page({ params }: { params: { tenant: string } }) {
  // Server-side data fetching scoped by tenant
  const settings = await getSettingsForTenant(params.tenant);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      {/* Render settings as needed */}
      <pre className="bg-gray-100 p-4 rounded text-xs text-gray-700">{JSON.stringify(settings, null, 2)}</pre>
    </div>
  );
}
