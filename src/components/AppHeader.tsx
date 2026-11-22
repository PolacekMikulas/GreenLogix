import { Link } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import { UserMenu } from "@/components/UserMenu";

const TABS = [
  { label: "Plan runs", to: "/" as const },
  { label: "Orders", to: "/orders" as const },
  { label: "Team", to: "/drivers" as const },
  { label: "Vehicles", to: "/vehicles" as const },
  { label: "Settings", to: "/settings" as const },
];

export function AppHeader({ right }: { right?: React.ReactNode }) {
  const tr = useT();
  return (
    <header className="bg-header text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-3">
        <a href="/" aria-label="GreenLogix — reload" className="font-display text-xl font-bold tracking-tight">
          Green<span className="text-lime">Logix</span>
        </a>
        <nav className="flex gap-1 text-sm">
          {TABS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              activeOptions={{ exact: true }}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-white/70 hover:text-white data-[status=active]:bg-lime data-[status=active]:font-medium data-[status=active]:text-header"
            >
              {tr(t.label)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {right}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
