import { useQueryClient } from "@tanstack/react-query";
import { 
  useCreateClient, 
  useUpdateClient, 
  useDeleteClient,
  useUpsertIncomeSources,
  useUpdatePayment,
  getListClientsQueryKey,
  getGetClientQueryKey,
  getListIncomeSourcesQueryKey,
  getListPaymentsQueryKey,
  getGetTaxSummaryQueryKey
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export function useTaxMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createClient = useCreateClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        toast({ title: "Client created successfully" });
      },
      onError: (error: any) => {
        toast({ title: "Failed to create client", description: error.message, variant: "destructive" });
      }
    }
  });

  const updateClient = useUpdateClient({
    mutation: {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(variables.clientId) });
        queryClient.invalidateQueries({ queryKey: getGetTaxSummaryQueryKey(variables.clientId) });
        queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey(variables.clientId) });
        toast({ title: "Client updated successfully" });
      },
      onError: (error: any) => {
        toast({ title: "Failed to update client", description: error.message, variant: "destructive" });
      }
    }
  });

  const deleteClient = useDeleteClient({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
        toast({ title: "Client deleted successfully" });
      },
      onError: (error: any) => {
        toast({ title: "Failed to delete client", description: error.message, variant: "destructive" });
      }
    }
  });

  const upsertIncomeSources = useUpsertIncomeSources({
    mutation: {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries({ queryKey: getListIncomeSourcesQueryKey(variables.clientId) });
        // Invalidate summary and payments since income changes update both
        queryClient.invalidateQueries({ queryKey: getGetTaxSummaryQueryKey(variables.clientId) });
        queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey(variables.clientId) });
        toast({ title: "Income sources saved successfully" });
      },
      onError: (error: any) => {
        toast({ title: "Failed to save income sources", description: error.message, variant: "destructive" });
      }
    }
  });

  const updatePayment = useUpdatePayment({
    mutation: {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey(variables.clientId) });
        toast({ title: "Payment updated successfully" });
      },
      onError: (error: any) => {
        toast({ title: "Failed to update payment", description: error.message, variant: "destructive" });
      }
    }
  });

  return {
    createClient,
    updateClient,
    deleteClient,
    upsertIncomeSources,
    updatePayment
  };
}
