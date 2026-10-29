import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListClients } from "@workspace/api-client-react";
import { 
  Briefcase,
  LayoutDashboard, 
  Users, 
  Settings, 
  Plus, 
  Search,
  ChevronRight,
  Menu,
  Building2,
  FileText,
  Calculator,
  TrendingDown
} from "lucide-react";
const logoUrl = "/images/brand.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientFormDialog } from "@/components/client/ClientFormDialog";
import { motion, AnimatePresence } from "framer-motion";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { data: clients, isLoading } = useListClients();
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);

  const filteredClients = clients?.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.scorporationName && c.scorporationName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border w-64 md:w-72 flex-shrink-0 transition-all duration-300">
      <div className="px-5 py-4 border-b border-sidebar-border/50 bg-white">
        <img src={logoUrl} alt="Shaqildi CPA Group" className="h-12 w-auto" />
      </div>

      <div className="p-4 space-y-1">
        <Link href="/" className="block">
          <Button 
            variant="ghost" 
            className={`w-full justify-start gap-3 rounded-lg ${location === "/" ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/50"}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard Overview
          </Button>
        </Link>
        <Link href="/s-corp-calculator" className="block">
          <Button
            variant="ghost"
            className={`w-full justify-start gap-3 rounded-lg ${location === "/s-corp-calculator" ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/50"}`}
          >
            <Calculator className="w-4 h-4" />
            S Corp Calculator
          </Button>
        </Link>
        <Link href="/tax-savings-analyzer" className="block">
          <Button
            variant="ghost"
            className={`w-full justify-start gap-3 rounded-lg ${location.startsWith("/tax-savings-analyzer") ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/50"}`}
          >
            <TrendingDown className="w-4 h-4" />
            Tax Savings Analyzer
          </Button>
        </Link>
      </div>

      <div className="px-4 pb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold text-sidebar-foreground/50 uppercase tracking-wider">Clients</h2>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-sidebar-foreground/50 hover:text-white"
          onClick={() => setIsClientDialogOpen(true)}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="px-4 pb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-sidebar-foreground/40" />
          <Input 
            placeholder="Search clients..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-sidebar-accent/30 border-transparent text-sm pl-9 h-9 text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus-visible:ring-1 focus-visible:ring-sidebar-ring focus-visible:border-sidebar-ring"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar pb-6">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <Skeleton className="w-8 h-8 rounded-full bg-sidebar-accent" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-24 bg-sidebar-accent" />
                <Skeleton className="h-2 w-16 bg-sidebar-accent" />
              </div>
            </div>
          ))
        ) : filteredClients?.length === 0 ? (
          <div className="text-center px-4 py-8">
            <Users className="w-8 h-8 text-sidebar-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-sidebar-foreground/50">No clients found</p>
          </div>
        ) : (
          filteredClients?.map((client) => {
            const isActive = location === `/clients/${client.id}`;
            return (
              <Link key={client.id} href={`/clients/${client.id}`} className="block">
                <button 
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left group
                    ${isActive 
                      ? "bg-primary/10 text-white relative overflow-hidden" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-white"
                    }`}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="active-indicator"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" 
                    />
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors
                    ${isActive ? "bg-primary text-primary-foreground" : "bg-sidebar-accent text-sidebar-foreground/80 group-hover:bg-sidebar-accent/80"}`}
                  >
                    {client.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className={`text-sm font-medium truncate ${isActive ? "text-white" : ""}`}>
                      {client.name}
                    </p>
                    {client.scorporationName && (
                      <p className="text-[10px] text-sidebar-foreground/50 truncate flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" />
                        {client.scorporationName}
                      </p>
                    )}
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 text-primary shrink-0" />}
                </button>
              </Link>
            )
          })
        )}
      </div>
      
      <div className="p-4 border-t border-sidebar-border mt-auto">
        <Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/60 hover:text-white hover:bg-sidebar-accent">
          <Settings className="w-4 h-4" />
          Settings
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans text-foreground">
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full z-20 shadow-2xl shadow-black/10">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="fixed inset-y-0 left-0 z-50 shadow-2xl"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-border shadow-sm z-30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <h1 className="font-display font-bold text-lg text-foreground">Shaqildi CPA Group</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="w-6 h-6" />
          </Button>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto custom-scrollbar relative">
          {children}
        </main>
      </div>

      <ClientFormDialog 
        open={isClientDialogOpen} 
        onOpenChange={setIsClientDialogOpen} 
      />
    </div>
  );
}
