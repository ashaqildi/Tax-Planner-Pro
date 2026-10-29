import React, { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  useGetClient,
  useListIncomeSources,
  useGetTaxSummary,
  useListPayments,
  useUpsertIncomeSources,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Calendar, FileText, Calculator, Clock, Settings2, Download, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ClientFormDialog } from "@/components/client/ClientFormDialog";
import { IncomeTab } from "@/components/client/IncomeTab";
import { SummaryTab } from "@/components/client/SummaryTab";
import { PaymentsTab } from "@/components/client/PaymentsTab";
import { generateClientPdf } from "@/lib/generatePdf";
import { useQueryClient } from "@tanstack/react-query";
import { getListIncomeSourcesQueryKey, getGetTaxSummaryQueryKey, getListPaymentsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
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

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const clientId = parseInt(id || "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: client, isLoading: isClientLoading, error } = useGetClient(clientId);

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const handleExportPdf = async () => {
    if (!client) return;
    setIsExporting(true);
    try {
      await generateClientPdf(client, taxSummary, payments ?? [], selectedYear, incomeSources ?? []);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (client && !selectedYear) {
      setSelectedYear(client.currentTaxYear);
    }
  }, [client]);

  const { data: incomeSources, isLoading: isIncomeLoading } = useListIncomeSources(clientId, { taxYear: selectedYear });
  const { data: taxSummary, isLoading: isSummaryLoading } = useGetTaxSummary(clientId, { taxYear: selectedYear });
  const { data: payments, isLoading: isPaymentsLoading } = useListPayments(clientId, { taxYear: selectedYear });

  const upsertIncome = useUpsertIncomeSources();

  const handleCopyToNextYear = async () => {
    const currentIncome = incomeSources?.find(i => i.taxYear === selectedYear);
    if (!currentIncome) return;
    setIsCopying(true);
    const nextYear = selectedYear + 1;
    try {
      await new Promise<void>((resolve, reject) => {
        upsertIncome.mutate({
          clientId,
          data: {
            taxYear: nextYear,
            w2Entries: (currentIncome as any).w2Entries ?? undefined,
            scorpEntries: (currentIncome as any).scorpEntries ?? undefined,
            w2Wages: currentIncome.w2Wages !== null ? Number(currentIncome.w2Wages) : undefined,
            interest1099: currentIncome.interest1099 !== null ? Number(currentIncome.interest1099) : undefined,
            dividends1099: currentIncome.dividends1099 !== null ? Number(currentIncome.dividends1099) : undefined,
            qualifiedDividends: currentIncome.qualifiedDividends !== null ? Number(currentIncome.qualifiedDividends) : undefined,
            nec1099: currentIncome.nec1099 !== null ? Number(currentIncome.nec1099) : undefined,
            misc1099: currentIncome.misc1099 !== null ? Number(currentIncome.misc1099) : undefined,
            scorpK1Ordinary: currentIncome.scorpK1Ordinary !== null ? Number(currentIncome.scorpK1Ordinary) : undefined,
            scorpK1OtherIncome: currentIncome.scorpK1OtherIncome !== null ? Number(currentIncome.scorpK1OtherIncome) : undefined,
            partnershipK1Ordinary: currentIncome.partnershipK1Ordinary !== null ? Number(currentIncome.partnershipK1Ordinary) : undefined,
            partnershipK1OtherIncome: currentIncome.partnershipK1OtherIncome !== null ? Number(currentIncome.partnershipK1OtherIncome) : undefined,
            rentalIncome: currentIncome.rentalIncome !== null ? Number(currentIncome.rentalIncome) : undefined,
            capitalGainsShortTerm: currentIncome.capitalGainsShortTerm !== null ? Number(currentIncome.capitalGainsShortTerm) : undefined,
            capitalGainsLongTerm: currentIncome.capitalGainsLongTerm !== null ? Number(currentIncome.capitalGainsLongTerm) : undefined,
            socialSecurity: currentIncome.socialSecurity !== null ? Number(currentIncome.socialSecurity) : undefined,
            pensionRetirement: currentIncome.pensionRetirement !== null ? Number(currentIncome.pensionRetirement) : undefined,
            otherIncome: currentIncome.otherIncome !== null ? Number(currentIncome.otherIncome) : undefined,
            federalWithheld: currentIncome.federalWithheld !== null ? Number(currentIncome.federalWithheld) : undefined,
            stateWithheld: currentIncome.stateWithheld !== null ? Number(currentIncome.stateWithheld) : undefined,
            priorYearFederalTax: currentIncome.priorYearFederalTax !== null ? Number(currentIncome.priorYearFederalTax) : undefined,
            priorYearStateTax: currentIncome.priorYearStateTax !== null ? Number(currentIncome.priorYearStateTax) : undefined,
            itemizedDeductions: (currentIncome as any).itemizedDeductions !== null ? Number((currentIncome as any).itemizedDeductions) : undefined,
            notes: currentIncome.notes ?? undefined,
          } as any,
        }, { onSuccess: () => resolve(), onError: (e) => reject(e) });
      });
      queryClient.invalidateQueries({ queryKey: getListIncomeSourcesQueryKey(clientId) });
      queryClient.invalidateQueries({ queryKey: getGetTaxSummaryQueryKey(clientId) });
      queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey(clientId) });
      toast({ title: `Income data copied to ${nextYear} tax year successfully.` });
      setSelectedYear(nextYear);
    } catch {
      toast({ title: "Failed to copy income data", variant: "destructive" });
    } finally {
      setIsCopying(false);
      setShowCopyDialog(false);
    }
  };

  if (isClientLoading) {
    return (
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <div className="h-8 w-32 bg-slate-100 animate-pulse rounded"></div>
        <div className="h-24 w-full bg-slate-100 animate-pulse rounded-2xl"></div>
        <div className="h-96 w-full bg-slate-100 animate-pulse rounded-2xl"></div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center h-full">
        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
          <FileText className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Client Not Found</h2>
        <p className="text-slate-500 mb-6">The client you are looking for does not exist or has been deleted.</p>
        <Link href="/">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const currentY = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentY - 2 + i);
  const hasCurrentYearData = incomeSources?.some(i => i.taxYear === selectedYear);
  const nextYear = selectedYear + 1;

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto min-h-full flex flex-col">
      {/* Header Area */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{client.name}</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 bg-white p-6 md:p-8 rounded-3xl border border-border shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none" />

          <div className="flex items-center gap-5 relative z-10">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center font-display font-bold text-3xl shadow-lg shadow-primary/20">
              {client.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2 tracking-tight">{client.name}</h1>
              <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm font-medium">
                <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-0 px-2.5 py-1">
                  {client.filingStatus.replace(/_/g, ' ')}
                </Badge>
                {client.scorporationName && (
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <Building2 className="w-4 h-4" />
                    {client.scorporationName}
                  </span>
                )}
                {client.pteElection && (
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200 px-2 py-0.5">
                    PTE Active
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 relative z-10 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-500" />
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(parseInt(v, 10))}
              >
                <SelectTrigger className="w-28 h-8 border-0 bg-transparent shadow-none focus:ring-0 font-bold text-slate-800">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y.toString()}>{y} Tax Year</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasCurrentYearData && (
              <Button
                variant="outline"
                className="bg-white"
                onClick={() => setShowCopyDialog(true)}
                disabled={isCopying}
                title={`Copy ${selectedYear} inputs to ${nextYear}`}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy to {nextYear}
              </Button>
            )}

            <Button
              variant="outline"
              className="bg-white"
              onClick={handleExportPdf}
              disabled={isExporting}
            >
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? "Generating..." : "Export PDF"}
            </Button>

            <Button
              variant="outline"
              className="bg-white"
              onClick={() => setIsEditOpen(true)}
            >
              <Settings2 className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs Area */}
      <Tabs defaultValue="income" className="flex-1 flex flex-col">
        <div className="bg-white/60 backdrop-blur-md sticky top-0 z-20 pb-4 pt-2 -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="bg-slate-100/80 p-1 rounded-xl w-full sm:w-auto flex overflow-x-auto custom-scrollbar border border-slate-200">
            <TabsTrigger value="income" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary flex-1 sm:flex-none">
              <FileText className="w-4 h-4 mr-2" />
              Income Sources
            </TabsTrigger>
            <TabsTrigger value="summary" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary flex-1 sm:flex-none">
              <Calculator className="w-4 h-4 mr-2" />
              Tax Summary
            </TabsTrigger>
            <TabsTrigger value="payments" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary flex-1 sm:flex-none">
              <Clock className="w-4 h-4 mr-2" />
              Est. Payments
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-4 flex-1">
          <TabsContent value="income" className="m-0 h-full">
            <IncomeTab
              client={client}
              incomeSources={incomeSources}
              taxYear={selectedYear}
            />
          </TabsContent>
          <TabsContent value="summary" className="m-0 h-full">
            <SummaryTab
              summary={taxSummary}
              payments={payments}
              isLoading={isSummaryLoading || isPaymentsLoading}
            />
          </TabsContent>
          <TabsContent value="payments" className="m-0 h-full">
            <PaymentsTab
              client={client}
              payments={payments}
              quarterSummaries={taxSummary?.quarters}
              isLoading={isPaymentsLoading || isSummaryLoading}
            />
          </TabsContent>
        </div>
      </Tabs>

      <ClientFormDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        client={client}
      />

      {/* Copy to Next Year Dialog */}
      <AlertDialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copy {selectedYear} Inputs to {nextYear}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will copy all income source inputs from <strong>{selectedYear}</strong> into <strong>{nextYear}</strong>.
              Estimated payment records are not copied — those will be generated fresh based on the copied income.
              Any existing {nextYear} income data will be overwritten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCopyToNextYear}
              disabled={isCopying}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {isCopying ? "Copying..." : `Copy to ${nextYear}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
