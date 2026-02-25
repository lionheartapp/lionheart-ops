
import { useState } from "react";
import { Plus, MoreVertical } from "lucide-react";

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
  // Use product palette and accessible contrast
  const color =
    type === "active"
      ? "bg-primary-100 text-primary-700 border border-primary-200"
      : type === "pending"
      ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
      : type === "inactive"
      ? "bg-gray-100 text-gray-700 border border-gray-200"
      : type === "new"
      ? "bg-blue-100 text-blue-700 border border-blue-200"
      : "bg-gray-100 text-gray-700 border border-gray-200";
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${color}`}>{status}</span>
  );
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
        <div className="text-2xl font-bold text-primary-900">Members</div>
        <button className="bg-primary-600 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition font-semibold">
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>
      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
              tab === t.value
                ? "bg-primary-50 border-primary-500 text-primary-700"
                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            } focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <div className="flex items-center gap-2 p-4 border-b border-gray-100">
          <input
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 placeholder-gray-400 font-medium"
            placeholder="Search members"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-gray-700 border-b bg-primary-50">
              <th className="py-3 px-4 text-left font-semibold">Name</th>
              <th className="py-3 px-4 text-left font-semibold">Email</th>
              <th className="py-3 px-4 text-left font-semibold">Status</th>
              <th className="py-3 px-4 text-left font-semibold">Permissions</th>
              <th className="py-3 px-4 text-left font-semibold">Date Added</th>
              <th className="py-3 px-4 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-400 font-medium">
                  No members found.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-b last:border-b-0 hover:bg-primary-50 transition">
                  <td className="py-3 px-4 flex items-center gap-3">
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 font-bold text-primary-700 border border-primary-200">
                      {u.avatar}
                    </span>
                    <div className="font-semibold text-primary-900">{u.name}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-700 font-medium">{u.email}</td>
                  <td className="py-3 px-4">{statusBadge(u.status, u.statusType)}</td>
                  <td className="py-3 px-4 text-sm text-primary-700 font-semibold">{u.permissions}</td>
                  <td className="py-3 px-4 text-xs text-gray-700 font-medium">{u.dateAdded}</td>
                  <td className="py-3 px-4">
                    <button className="text-primary-600 hover:underline mr-2 font-semibold">View profile</button>
                    <button className="p-2 hover:bg-primary-50 rounded-full">
                      <MoreVertical className="w-4 h-4 text-primary-700" />
                    </button>
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