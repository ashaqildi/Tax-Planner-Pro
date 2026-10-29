import React, { useState } from "react";
import { Link } from "wouter";
import { useListClients } from "@workspace/api-client-react";
import { 
  Calculator, 
  CalendarDays, 
  ChevronRight, 
  Plus, 
  Users,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClientFormDialog } from "@/components/client/ClientFormDialog";

function getCurrentTaxYear(): number {
  return new Date().getFullYear();
}

function getCurrentQuarterLabel(): string {
  const month = new Date().getMonth() + 1;
  if (month <= 4) return "Q1 Payments approaching";
  if (month <= 6) return "Q2 Payments approaching";
  if (month <= 9) return "Q3 Payments approaching";
  return "Q4 Payments approaching";
}

export default function Home() {
  const { data: clients, isLoading } = useListClients();
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);

  const taxYear = getCurrentTaxYear();
  const quarterLabel = getCurrentQuarterLabel();

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto min-h-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">Dashboard Overview</h1>
          <p className="text-muted-foreground">Manage your firm's estimated tax payments and client portfolios.</p>
        </div>
        <Button 
          onClick={() => setIsClientDialogOpen(true)}
          className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Client
        </Button>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <Card className="border-border/60 shadow-sm bg-white overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users className="w-24 h-24" />
          </div>
          <CardContent className="p-6 relative z-10">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Clients</p>
            <h2 className="text-4xl font-display font-bold text-foreground">
              {isLoading ? "-" : clients?.length || 0}
            </h2>
          </CardContent>
        </Card>
        
        <Card className="border-border/60 shadow-sm bg-white overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-emerald-600">
            <Calculator className="w-24 h-24" />
          </div>
          <CardContent className="p-6 relative z-10">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">PTE Elections</p>
            <h2 className="text-4xl font-display font-bold text-foreground">
              {isLoading ? "-" : clients?.filter(c => c.pteElection).length || 0}
            </h2>
            <p className="text-sm text-emerald-600 font-medium mt-2">Active business entities</p>
          </CardContent>
        </Card>
        
        <Card className="border-border/60 shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transition-opacity text-white">
            <CalendarDays className="w-24 h-24" />
          </div>
          <CardContent className="p-6 relative z-10">
            <p className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-1">Current Tax Year</p>
            <h2 className="text-4xl font-display font-bold text-white">{taxYear}</h2>
            <p className="text-sm text-slate-400 font-medium mt-2">{quarterLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Tools ────────────────────────────────────────────────────── */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-display font-bold flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Tax Planning Tools
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/s-corp-calculator" className="block group">
            <Card className="border-border/60 shadow-sm bg-white overflow-hidden relative h-full hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-primary">
                <Calculator className="w-20 h-20" />
              </div>
              <CardContent className="p-6 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <Calculator className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-display font-bold text-foreground mb-1">S Corp Calculator</h4>
                <p className="text-sm text-muted-foreground">Compare Schedule C vs S Corporation tax burden side by side with PDF export.</p>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                  Open Calculator
                  <ChevronRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/tax-savings-analyzer" className="block group">
            <Card className="border-border/60 shadow-sm bg-white overflow-hidden relative h-full hover:shadow-md hover:border-amber-400/50 transition-all duration-200 cursor-pointer">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-amber-600">
                <TrendingDown className="w-20 h-20" />
              </div>
              <CardContent className="p-6 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
                  <TrendingDown className="w-5 h-5 text-amber-600" />
                </div>
                <h4 className="font-display font-bold text-foreground mb-1">Tax Savings Analyzer</h4>
                <p className="text-sm text-muted-foreground">Build client tax plans across 28 strategies and export branded PDF reports.</p>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-amber-600 group-hover:gap-2 transition-all">
                  Open Tool
                  <ChevronRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/clients" className="block group">
            <Card className="border-border/60 shadow-sm bg-white overflow-hidden relative h-full hover:shadow-md hover:border-emerald-400/50 transition-all duration-200 cursor-pointer">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-emerald-600">
                <Users className="w-20 h-20" />
              </div>
              <CardContent className="p-6 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <h4 className="font-display font-bold text-foreground mb-1">All Clients</h4>
                <p className="text-sm text-muted-foreground">View client portfolios, manage income sources, and track estimated tax payments.</p>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-emerald-600 group-hover:gap-2 transition-all">
                  View All Clients
                  <ChevronRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <ClientFormDialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen} />
    </div>
  );
}
