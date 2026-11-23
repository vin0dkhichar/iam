"use client";

interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex flex-wrap items-end gap-2 mb-0 ml-5" role="tablist">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`inline-flex items-center justify-center px-6 py-3 border-none rounded-t-[10px] rounded-b-none bg-[#e1e1e1] text-black text-[18px] font-semibold leading-[1.3] cursor-pointer transition-colors duration-150 ${isActive ? "bg-[#f5bb1a]" : "hover:bg-[#d4d4d4]"}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
