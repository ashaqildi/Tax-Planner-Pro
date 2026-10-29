import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Clients from "@/pages/Clients";
import ClientDetail from "@/pages/ClientDetail";
import SCorpCalculator from "@/pages/SCorpCalculator";
import TaxSavingsAnalyzerIndex from "@/pages/TaxSavingsAnalyzer/index";
import NewPlan from "@/pages/TaxSavingsAnalyzer/NewPlan";
import { AppLayout } from "@/components/layout/AppLayout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/clients" component={Clients} />
        <Route path="/clients/:id" component={ClientDetail} />
        <Route path="/s-corp-calculator" component={SCorpCalculator} />
        <Route path="/tax-savings-analyzer" component={TaxSavingsAnalyzerIndex} />
        <Route path="/tax-savings-analyzer/new" component={() => <NewPlan />} />
        <Route path="/tax-savings-analyzer/:id">
          {(params) => <NewPlan planId={params.id ?? undefined} />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={"/".replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
