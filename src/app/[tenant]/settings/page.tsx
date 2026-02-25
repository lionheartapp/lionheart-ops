
import { getSettingsForTenant } from '@/lib/services/settings.service';

type PageProps = {
  params: Promise<{ tenant: string }>;
};

export default async function Page({ params }: PageProps) {
  const { tenant } = await params;
  const settings = await getSettingsForTenant(tenant);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      {/* Render settings as needed */}
      <pre className="bg-gray-100 p-4 rounded text-xs text-gray-700">{JSON.stringify(settings, null, 2)}</pre>
    </div>
  );
}
