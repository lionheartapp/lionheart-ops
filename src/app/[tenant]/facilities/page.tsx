
import { getFacilitiesForTenant } from '@/lib/services/facilities.service';

type PageProps = {
  params: Promise<{ tenant: string }>;
};

export default async function Page({ params }: PageProps) {
  const { tenant } = await params;
  const facilities = await getFacilitiesForTenant(tenant);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Facilities</h2>
      {facilities.length === 0 ? (
        <div className="text-gray-500">No facilities found for this workspace.</div>
      ) : (
        <ul className="space-y-2">
          {facilities.map((facility: { id: string; displayName: string | null; roomNumber: string; floor: string | null }) => (
            <li key={facility.id} className="bg-white p-4 rounded shadow">
              <div className="font-semibold text-primary-900">{facility.displayName || facility.roomNumber}</div>
              <div className="text-xs text-gray-600">Floor: {facility.floor || 'N/A'}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
