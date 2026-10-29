-- Schema-only bootstrap captured from the actual Replit PostgreSQL database.
-- No customer rows, credentials, ownership or grants. Apply only to an empty target.
--
-- PostgreSQL database dump
--

-- Dumped from database version 16.15 (f37ae9a)
-- Dumped by pg_dump version 16.3

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    name text NOT NULL,
    email text,
    filing_status text DEFAULT 'single'::text NOT NULL,
    pte_election boolean DEFAULT false NOT NULL,
    scorporation_name text,
    scorporation_ein text,
    current_tax_year integer DEFAULT 2025 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- Name: estimated_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estimated_payments (
    id integer NOT NULL,
    client_id integer NOT NULL,
    tax_year integer NOT NULL,
    quarter integer NOT NULL,
    payment_type text NOT NULL,
    due_date date NOT NULL,
    amount_due numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    amount_paid numeric(12,2),
    confirmation_number text,
    paid_date date,
    notes text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    entity_name text
);


--
-- Name: estimated_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.estimated_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: estimated_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.estimated_payments_id_seq OWNED BY public.estimated_payments.id;


--
-- Name: income_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.income_sources (
    id integer NOT NULL,
    client_id integer NOT NULL,
    tax_year integer NOT NULL,
    w2_wages numeric(12,2),
    interest_1099 numeric(12,2),
    dividends_1099 numeric(12,2),
    qualified_dividends numeric(12,2),
    nec_1099 numeric(12,2),
    misc_1099 numeric(12,2),
    scorp_k1_ordinary numeric(12,2),
    scorp_k1_other_income numeric(12,2),
    partnership_k1_ordinary numeric(12,2),
    partnership_k1_other_income numeric(12,2),
    rental_income numeric(12,2),
    capital_gains_short_term numeric(12,2),
    capital_gains_long_term numeric(12,2),
    social_security numeric(12,2),
    pension_retirement numeric(12,2),
    other_income numeric(12,2),
    federal_withheld numeric(12,2),
    state_withheld numeric(12,2),
    prior_year_federal_tax numeric(12,2),
    prior_year_state_tax numeric(12,2),
    notes text,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    w2_entries jsonb,
    scorp_entries jsonb,
    itemized_deductions numeric(12,2),
    apply_qbi_deduction boolean DEFAULT false
);


--
-- Name: income_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.income_sources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: income_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.income_sources_id_seq OWNED BY public.income_sources.id;


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: estimated_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimated_payments ALTER COLUMN id SET DEFAULT nextval('public.estimated_payments_id_seq'::regclass);


--
-- Name: income_sources id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_sources ALTER COLUMN id SET DEFAULT nextval('public.income_sources_id_seq'::regclass);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: estimated_payments estimated_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimated_payments
    ADD CONSTRAINT estimated_payments_pkey PRIMARY KEY (id);


--
-- Name: income_sources income_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_sources
    ADD CONSTRAINT income_sources_pkey PRIMARY KEY (id);


--
-- Name: estimated_payments estimated_payments_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimated_payments
    ADD CONSTRAINT estimated_payments_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: income_sources income_sources_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income_sources
    ADD CONSTRAINT income_sources_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

