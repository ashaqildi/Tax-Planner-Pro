import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListClients, useDeleteClient } from "@workspace/api-client-react";
import { 
  Building2, 
  ChevronRight,
  Plus, 
  TrendingUp, 
  Users,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClientFormDialog } from "@/components/client/ClientFormDialog";
import { useQueryClient } from "@tanstack/react-query";

function filingStatusLabel(s: string): string {
  const map: Record<string, string> = {
    single: "Single",
    married_filing_jointly: "Married Filing Jointly",
    married_filing_separately: "Married Filing Separately",
    head_of_household: "Head of Household",
  };
  return map[s] ?? s;
}

export default function Clients() {
  const { data: clients, isLoading } = useListClients();
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const deleteClient = useDeleteClient();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteClient.mutateAsync({ clientId: deleteTarget.id });
    queryClient.invalidateQueries({ queryKey: ["listClients"] });
    setDeleteTarget(null);
  };
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto min-h-full">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-primary">Back to Dashboard</Link>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mt-3 mb-2">All Clients</h1>
          <p className="text-muted-foreground">Manage your client portfolios and estimated tax payments.</p>
        </div>
        <Button onClick={() => setIsClientDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" />Add New Client
        </Button>
      </div>
      {/* ── Client list ────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-display font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Client Directory
          </h3>
          <span className="text-sm text-muted-foreground">{clients?.length ?? 0} total</span>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : clients?.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-600 mb-2">No clients yet</h3>
            <p className="text-slate-400 mb-6 max-w-sm mx-auto">Get started by adding your first client to manage their tax estimates.</p>
            <Button onClick={() => setIsClientDialogOpen(true)}>Add Client</Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 shadow-sm overflow-hidden bg-white">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1.5fr_1fr_80px_80px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Client</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Entity / S-Corp</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filing Status</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Tax Year</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Actions</span>
            </div>

            {/* Rows */}
            {clients?.map((client, idx) => (
              <div
                key={client.id}
                className={`grid grid-cols-[2fr_1.5fr_1fr_80px_80px] gap-4 px-5 py-4 items-center group hover:bg-slate-50/70 transition-colors cursor-pointer ${idx !== 0 ? "border-t border-slate-100" : ""}`}
              >
                {/* Name + avatar — clicking navigates */}
                <div
                  className="flex items-center gap-3 min-w-0"
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    {client.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">{client.name}</p>
                    {client.email && <p className="text-[11px] text-muted-foreground truncate">{client.email}</p>}
                  </div>
                </div>

                {/* Entity */}
                <div
                  className="flex items-center gap-2 min-w-0"
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  {client.scorporationName ? (
                    <>
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-600 truncate">{client.scorporationName}</span>
                      {client.pteElection && (
                        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-100 text-emerald-700 border-0 hover:bg-emerald-100 shrink-0">PTE</Badge>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </div>

                {/* Filing status */}
                <div
                  className="text-sm text-slate-600 truncate"
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  {filingStatusLabel(client.filingStatus)}
                </div>

                {/* Tax year */}
                <div
                  className="text-center"
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  <span className="inline-block bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {client.currentTaxYear}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => navigate(`/clients/${client.id}`)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Open client"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ id: client.id, name: client.name });
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete client"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Delete confirm dialog ───────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              Delete Client
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              Are you sure you want to permanently delete <strong>{deleteTarget?.name}</strong>? This will remove all of their income records, payment history, and confirmation numbers. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteClient.isPending}
            >
              {deleteClient.isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClientFormDialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen} />
    </div>
  );
}
