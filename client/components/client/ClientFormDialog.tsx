import React, { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTaxMutations } from "@/hooks/use-tax-mutations";
import { Client, ClientFilingStatus } from "@workspace/api-client-react";

const clientSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  filingStatus: z.nativeEnum(ClientFilingStatus),
  pteElection: z.boolean(),
  scorporationName: z.string().optional().or(z.literal("")),
  scorporationEin: z.string().optional().or(z.literal("")),
  currentTaxYear: z.coerce.number().min(2020).max(2100),
});

type ClientFormValues = z.infer<typeof clientSchema>;

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client; // If provided, it's edit mode
}

export function ClientFormDialog({ open, onOpenChange, client }: ClientFormDialogProps) {
  const { createClient, updateClient } = useTaxMutations();
  const isEditing = !!client;

  const form = useForm<ClientFormValues>({
    // The resolver's bundled declarations resolve Zod 4, while this app uses Zod 3.
    // Both versions expose parseAsync, which the resolver calls at runtime.
    resolver: zodResolver(clientSchema as unknown as Parameters<typeof zodResolver>[0]) as Resolver<ClientFormValues>,
    defaultValues: {
      name: "",
      email: "",
      filingStatus: ClientFilingStatus.single,
      pteElection: false,
      scorporationName: "",
      scorporationEin: "",
      currentTaxYear: new Date().getFullYear(),
    },
  });

  useEffect(() => {
    if (client && open) {
      form.reset({
        name: client.name,
        email: client.email || "",
        filingStatus: client.filingStatus,
        pteElection: client.pteElection,
        scorporationName: client.scorporationName || "",
        scorporationEin: client.scorporationEin || "",
        currentTaxYear: client.currentTaxYear,
      });
    } else if (!open && !client) {
      form.reset({
        name: "",
        email: "",
        filingStatus: ClientFilingStatus.single,
        pteElection: false,
        scorporationName: "",
        scorporationEin: "",
        currentTaxYear: new Date().getFullYear(),
      });
    }
  }, [client, open, form]);

  const onSubmit = (values: ClientFormValues) => {
    // Convert empty strings to null for backend
    const payload = {
      ...values,
      email: values.email || null,
      scorporationName: values.scorporationName || null,
      scorporationEin: values.scorporationEin || null,
    };

    if (isEditing && client) {
      updateClient.mutate({ clientId: client.id, data: payload }, {
        onSuccess: () => onOpenChange(false)
      });
    } else {
      createClient.mutate({ data: payload }, {
        onSuccess: () => onOpenChange(false)
      });
    }
  };

  const isPending = createClient.isPending || updateClient.isPending;
  const pteElection = form.watch("pteElection");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-white">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{isEditing ? "Edit Client" : "New Client Profile"}</DialogTitle>
          <DialogDescription>
            Enter the client's core tax information. This will drive all calculations.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe or Business Name" {...field} className="focus-visible:ring-primary/20" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="john@example.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="filingStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Filing Status *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select filing status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married_filing_jointly">Married Filing Jointly</SelectItem>
                        <SelectItem value="married_filing_separately">Married Filing Separately</SelectItem>
                        <SelectItem value="head_of_household">Head of Household</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currentTaxYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Tax Year *</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
              <FormField
                control={form.control}
                name="pteElection"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Pass-Through Entity (PTE) Election</FormLabel>
                      <FormDescription>
                        Does this client elect to pay Illinois state tax at the entity level?
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="scorporationName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>S-Corp / Entity Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe Enterprises Inc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scorporationEin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entity EIN</FormLabel>
                      <FormControl>
                        <Input placeholder="XX-XXXXXXX" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button 
                type="submit" 
                disabled={isPending}
                className="bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg transition-all"
              >
                {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Client"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
