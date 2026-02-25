import { getEventsForTenant } from '@/lib/services/events.service';

export default async function EventsPage({ params }: { params: { tenant: string } }) {
  // Server-side data fetching scoped by tenant
  const events = await getEventsForTenant(params.tenant);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Events</h2>
      {events.length === 0 ? (
        <div className="text-gray-500">No events found for this workspace.</div>
      ) : (
        <ul className="space-y-2">
          {events.map(event => (
            <li key={event.id} className="bg-white p-4 rounded shadow">
              <div className="font-semibold text-primary-900">{event.title}</div>
              <div className="text-xs text-gray-600">{event.date}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
