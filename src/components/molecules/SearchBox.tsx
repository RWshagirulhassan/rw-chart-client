// import * as React from "react";
// import { Search } from "lucide-react";

// import { Input } from "@/components/ui/input";
// import { cn } from "@/lib/utils";
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from "@/components/ui/popover";
// import {
//   Command,
//   CommandEmpty,
//   CommandItem,
//   CommandList,
// } from "@/components/ui/command";
// import { Badge } from "@/components/ui/badge";

// export type SearchResult = {
//   instrument_token: string;
//   name: string; // left big text (e.g. "NIFTY 50")
//   tradingsymbol?: string; // right small text (e.g. "NIFTY 50")
//   exchange?: string; // right pill (e.g. "INDICES")
// };

// type SearchBoxProps = {
//   placeholder?: string;
//   options?: SearchResult[];
//   onOptionSelect?: (r: SearchResult) => void;

//   /** optional: override filtering if you want */
//   filterFn?: (option: SearchResult, query: string) => boolean;

//   /** wrapper class (around input) */
//   className?: string;
// } & Omit<
//   React.ComponentProps<typeof Input>,
//   "results" | "onSelect" | "className"
// >;

// function HighlightMatch({ text, query }: { text: string; query: string }) {
//   const q = query.trim();
//   if (!q) return <>{text}</>;

//   const lower = text.toLowerCase();
//   const idx = lower.indexOf(q.toLowerCase());
//   if (idx === -1) return <>{text}</>;

//   const before = text.slice(0, idx);
//   const match = text.slice(idx, idx + q.length);
//   const after = text.slice(idx + q.length);

//   return (
//     <>
//       {before}
//       <span className="rounded-sm bg-muted px-1 py-0.5">{match}</span>
//       {after}
//     </>
//   );
// }

// export function SearchBox({
//   placeholder = "Search eg: infy, nifty fut, index fund, etc",
//   className,
//   options = [],
//   onOptionSelect,
//   filterFn,
//   ...props
// }: SearchBoxProps) {
//   const [open, setOpen] = React.useState(false);

//   // Support controlled + uncontrolled input value
//   const isControlled = props.value !== undefined;
//   const [uncontrolledValue, setUncontrolledValue] = React.useState("");
//   const query = isControlled ? String(props.value ?? "") : uncontrolledValue;

//   const filtered = React.useMemo(() => {
//     const q = query.trim().toLowerCase();
//     if (!q) return options;

//     if (filterFn) return options.filter((opt) => filterFn(opt, query));

//     // ✅ FIX: use opt.name (not opt.label)
//     return options.filter((opt) =>
//       `${opt.name} ${opt.tradingsymbol ?? ""} ${opt.exchange ?? ""}`
//         .toLowerCase()
//         .includes(q)
//     );
//   }, [options, query, filterFn]);

//   return (
//     <Popover open={open} onOpenChange={setOpen}>
//       <PopoverTrigger asChild>
//         <div className={cn("relative", className)}>
//           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//           <Input
//             {...props}
//             value={query}
//             onChange={(e) => {
//               if (!isControlled) setUncontrolledValue(e.target.value);
//               setOpen(true);
//               props.onChange?.(e);
//             }}
//             onFocus={(e) => {
//               setOpen(true);
//               props.onFocus?.(e);
//             }}
//             onKeyDown={(e) => {
//               if (e.key === "Escape") setOpen(false);
//               props.onKeyDown?.(e);
//             }}
//             className={cn(
//               "pl-10 h-10 rounded-none placeholder:text-xs",
//               props.className
//             )}
//             placeholder={placeholder}
//           />
//         </div>
//       </PopoverTrigger>

//       <PopoverContent
//         align="start"
//         side="bottom"
//         sideOffset={4}
//         onOpenAutoFocus={(e) => e.preventDefault()}
//         className="p-0 w-[--radix-popover-trigger-width] rounded-none"
//       >
//         <Command shouldFilter={false}>
//           <CommandList className="max-h-[520px] overflow-auto">
//             <CommandEmpty className="py-6 text-sm text-muted-foreground flex items-center justify-center">
//               No results.
//             </CommandEmpty>

//             {filtered.map((opt) => (
//               <CommandItem
//                 key={opt.tradingsymbol}
//                 value={`${opt.name} ${opt.tradingsymbol ?? ""} ${
//                   opt.exchange ?? ""
//                 }`}
//                 onSelect={() => {
//                   onOptionSelect?.(opt);
//                   setOpen(false);
//                 }}
//                 className={cn(
//                   "rounded-none px-4 py-4 border-b last:border-b-0",
//                   "flex items-center justify-between gap-3",
//                   "data-[selected=true]:bg-muted/60"
//                 )}
//               >
//                 {/* Left big text */}
//                 <div className="min-w-0">
//                   <div className="text-xs font-medium leading-5 truncate">
//                     <HighlightMatch text={opt.name} query={query} />
//                   </div>
//                 </div>

//                 {/* Right meta + exchange */}
//                 <div className="flex items-center gap-3 shrink-0">
//                   {opt.tradingsymbol ? (
//                     <div className="text-xs text-muted-foreground max-w-[200px] truncate">
//                       <HighlightMatch text={opt.tradingsymbol} query={query} />
//                     </div>
//                   ) : null}

//                   {opt.exchange ? (
//                     <Badge variant="secondary" className="rounded-none">
//                       {opt.exchange}
//                     </Badge>
//                   ) : null}
//                 </div>
//               </CommandItem>
//             ))}
//           </CommandList>
//         </Command>
//       </PopoverContent>
//     </Popover>
//   );
// }

import * as React from "react";
import { ChartNoAxesCombined, Plus, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type SearchResult = {
  instrument_token: string;
  name: string;
  tradingsymbol?: string;
  exchange?: string;
};

type SearchBoxProps = {
  placeholder?: string;
  options?: SearchResult[];
  loading?: boolean;
  onOptionSelect?: (r: SearchResult) => void;
  onOpenChart?: (r: SearchResult) => void;
  filterFn?: (option: SearchResult, query: string) => boolean;
  className?: string;
} & Omit<
  React.ComponentProps<typeof Input>,
  "results" | "onSelect" | "className"
>;

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;

  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);

  return (
    <>
      {before}
      <span className="font-semibold text-foreground">{match}</span>
      {after}
    </>
  );
}

export function SearchBox({
  placeholder = "Search eg: infy, nifty fut, index fund, etc",
  className,
  options = [],
  loading = false,
  onOptionSelect,
  onOpenChart,
  filterFn,
  ...props
}: SearchBoxProps) {
  const [open, setOpen] = React.useState(false);

  // Support controlled + uncontrolled input value
  const isControlled = props.value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState("");
  const query = isControlled ? String(props.value ?? "") : uncontrolledValue;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;

    if (filterFn) return options.filter((opt) => filterFn(opt, query));

    return options.filter((opt) =>
      `${opt.name} ${opt.tradingsymbol ?? ""} ${opt.exchange ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [options, query, filterFn]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative", className)}>
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            {...props}
            value={query}
            onChange={(e) => {
              if (!isControlled) setUncontrolledValue(e.target.value);
              setOpen(true);
              props.onChange?.(e);
            }}
            onFocus={(e) => {
              setOpen(true);
              props.onFocus?.(e);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              props.onKeyDown?.(e);
            }}
            className="h-8 pl-8 rounded-none placeholder:text-xs"
            placeholder={placeholder}
          />
        </div>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="p-0 w-[--radix-popover-trigger-width] rounded-none"
      >
        <Command shouldFilter={false}>
          <CommandList className="max-h-[520px] overflow-auto">
            <CommandEmpty className="py-6 text-sm text-muted-foreground flex items-center justify-center">
              {loading ? "Searching..." : "No results."}
            </CommandEmpty>

            {filtered.map((opt) => (
              <CommandItem
                key={`${opt.exchange ?? "NA"}:${opt.instrument_token}`}
                value={`${opt.name} ${opt.tradingsymbol ?? ""} ${
                  opt.exchange ?? ""
                }`}
                onSelect={() => {
                  onOptionSelect?.(opt);
                  setOpen(false);
                }}
                className={cn(
                  "group relative min-h-10 rounded-none border-b border-border px-3 py-2 last:border-b-0",
                  "flex items-center justify-between gap-2 data-[selected=true]:bg-muted/60 data-[selected=true]:text-foreground"
                )}
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="truncate text-xs font-medium leading-5 text-foreground">
                    <HighlightMatch
                      text={opt.tradingsymbol || opt.name}
                      query={query}
                    />
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    <HighlightMatch text={opt.name} query={query} />
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-2 group-hover:hidden">
                    {opt.exchange ? (
                      <Badge variant="secondary" className="h-5 rounded-none px-1.5 text-[10px]">
                        {opt.exchange}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">--</span>
                    )}
                  </div>

                  <div className="hidden items-center gap-2 group-hover:flex">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-none"
                      aria-label="Add to watchlist"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onOptionSelect?.(opt);
                        setOpen(false);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-none"
                      aria-label="Open chart"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onOpenChart?.(opt);
                        setOpen(false);
                      }}
                    >
                      <ChartNoAxesCombined className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
