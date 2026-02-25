
import { useState } from "react";
import { Plus, MoreVertical } from "lucide-react";
import Button from '@/components/ui/Button';

const MOCK_USERS = [
  {
    id: "1",
    name: "Shane Nguyen",
    email: "shanengu@labourlink.com",
    status: "Onboarded",
    statusType: "new",
    permissions: "Consultant",
    dateAdded: "07 Jun 2023",
    avatar: "SN",
  },
  {
    id: "2",
    name: "Arlene McCoy",
    email: "arlenemccoy@labourlink.com",
    status: "Active",
    statusType: "active",
    permissions: "Consultant",
    dateAdded: "24 Jan 2022",
    avatar: "AM",
  },
  {
    id: "3",
    name: "Guy Hawkins",
    email: "guyhawk@labourlink.com",
    status: "Inactive",
    statusType: "inactive",
    permissions: "Administrator",
    dateAdded: "18 Apr 2020",
    avatar: "GH",
  },
  {
    id: "4",
    name: "Dianne Russell",
    email: "diannerussell@labourlink.com",
    status: "Active",
    statusType: "active",
    permissions: "Manager",
    dateAdded: "02 Feb 2022",
    avatar: "DR",
  },
  {
    id: "5",
    name: "Albert Flores",
    email: "albertflores@labourlink.com",
    status: "Pending",
    statusType: "pending",
    permissions: "Consultant",
    dateAdded: "29 Jun 2022",
    avatar: "AF",
  },
];

const TABS = [
  { label: "All users", value: "all" },
  { label: "Administrator", value: "Administrator" },
  { label: "Manager", value: "Manager" },
  { label: "Consultant", value: "Consultant" },
];

function statusBadge(status: string, type: string) {
  const color =
    type === "active"
      ? "bg-green-100 text-green-700"
      : type === "pending"
      ? "bg-yellow-100 text-yellow-700"
      : type === "inactive"
      ? "bg-gray-100 text-gray-500"
      : type === "new"
      ? "bg-blue-100 text-blue-700"
      : "bg-gray-100 text-gray-700";
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>{status}</span>;
}

type MembersTabProps = { onDirtyChange?: (isDirty: boolean) => void }
const MembersTab = (_props: MembersTabProps) => {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [users] = useState(MOCK_USERS);

  const filtered = users.filter(
    (u) =>
      (tab === "all" || u.permissions === tab) &&
      (u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div className="text-2xl font-semibold">User groups</div>
        <Button icon={<Plus className="w-4 h-4" />} size="md">
          Add user
        </Button>
      </div>
      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <Button
            key={t.value}
            variant={tab === t.value ? 'primary' : 'secondary'}
            size="sm"
            className={tab === t.value ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <div className="flex items-center gap-2 p-4 border-b border-gray-100">
          <input
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Search users"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b">
              <th className="py-3 px-4 text-left font-medium">Name</th>
              <th className="py-3 px-4 text-left font-medium">Status</th>
              <th className="py-3 px-4 text-left font-medium">Permissions</th>
              <th className="py-3 px-4 text-left font-medium">Date added</th>
              <th className="py-3 px-4 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-400">
                  No users found.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="py-3 px-4 flex items-center gap-3">
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 font-bold text-gray-600">
                      {u.avatar}
                    </span>
                    <div>
                      <div className="font-medium text-gray-900">{u.name}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4">{statusBadge(u.status, u.statusType)}</td>
                  <td className="py-3 px-4">{u.permissions}</td>
                  <td className="py-3 px-4">{u.dateAdded}</td>
                  <td className="py-3 px-4">
                    <Button variant="secondary" size="sm" className="mr-2 underline text-blue-600 hover:bg-blue-50">
                      View profile
                    </Button>
                    <Button variant="secondary" size="sm" className="p-2 rounded-full hover:bg-gray-100">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MembersTab;