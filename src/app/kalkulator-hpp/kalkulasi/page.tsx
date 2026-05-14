"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  Plus,
  Minus,
  Calculator,
  Trash2,
  Info,
  TrendingUp,
  Sparkles,
  History,
  Layers,
  ArrowRight,
  Save,
  AlertCircle,
  CheckCircle2,
  X,
  Settings,
  Package,
  BookOpen,
  ShieldCheck,
  ShoppingBag,
  Zap,
  Briefcase,
  ArrowUpRight,
  Loader2,
  LayoutGrid,
  Camera,
  Wallet,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { addToSyncQueue } from "@/services/sync/syncManager";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { db } from "@/db/dexie";
import { useStaffStore } from "@/store/useStaffStore";
import { useLiveQuery } from "dexie-react-hooks";
import { uploadImage } from "@/services/cloudinary";
import { analyzeImage, analyzeText } from "@/services/aiService";
import { SettingsLayout } from "@/features/settings/SettingsLayout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { id as localeID } from "date-fns/locale";
import { createId } from "@/utils/uuid";

interface ProcessingCost {
  id: string;
  name: string;
  price: number | string;
  period: "per_batch" | "per_produk_turunan";
}

interface DerivedProduct {
  id: string;
  name: string;
  qty: number | string;
  unit: string;
  price_sell: number | string;
  target_profit?: number | string;
  selected_price?: number | string;
}

export default function SmartHppPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchId = searchParams.get("id");

  // App States
  const [step, setStep] = useState<0 | 1>(0);
  const [businessModel, setBusinessModel] = useState<
    | "production"
    | "reseller"
    | "culinary"
    | "ads_cod"
    | "marketplace"
    | "service"
    | "quick"
    | null
  >(null);

  // Input States
  const [businessName, setBusinessName] = useState("");
  const [batchPerMonth, setBatchPerMonth] = useState<number | string>(1);
  const [servingSize, setServingSize] = useState<number | string>(1);
  const [mainMaterial, setMainMaterial] = useState({
    name: "",
    price: "" as any,
    qty: "" as any,
    unit: "kg",
  });
  const [recipeMaterials, setRecipeMaterials] = useState<
    {
      id: string;
      name: string;
      price: number | string;
      qty: number | string;
      unit: string;
    }[]
  >([]);

  // Specific Costs
  const [labourCost, setLabourCost] = useState<number | string>(0);
  const [laborHours, setLaborHours] = useState<number | string>(0);
  const [laborRate, setLaborRate] = useState<number | string>(0);

  const [wastagePct, setWastagePct] = useState<number | string>(0);
  const [contingencyPct, setContingencyPct] = useState<number | string>(0);
  const [taxIncluded, setTaxIncluded] = useState(false);

  const [shippingCost, setShippingCost] = useState<number | string>(0);
  const [taxImportCost, setTaxImportCost] = useState<number | string>(0);
  const [insuranceCost, setInsuranceCost] = useState<number | string>(0);
  const [handlingFee, setHandlingFee] = useState<number | string>(0);
  const [packagingCost, setPackagingCost] = useState<number | string>(0);
  const [marketingInsertCost, setMarketingInsertCost] = useState<
    number | string
  >(0);

  const [utilityCosts, setUtilityCosts] = useState<number | string>(0);
  const [maintenanceCosts, setMaintenanceCosts] = useState<number | string>(0);

  // New states for expanded models
  const [adsCost, setAdsCost] = useState<number | string>(0);
  const [codFeePct, setCodFeePct] = useState<number | string>(0);
  const [returnRatePct, setReturnRatePct] = useState<number | string>(0);

  const [marketplaceAdminFee, setMarketplaceAdminFee] = useState<
    number | string
  >(0);
  const [shippingSubsidy, setShippingSubsidy] = useState<number | string>(0);
  const [campaignFee, setCampaignFee] = useState<number | string>(0);

  const [serviceDuration, setServiceDuration] = useState<number | string>(0);
  const [serviceRate, setServiceRate] = useState<number | string>(0);

  const [costs, setCosts] = useState<ProcessingCost[]>([]);
  const [derivedProducts, setDerivedProducts] = useState<DerivedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(!!batchId);

  const { session: user } = useStaffStore();
  const [isSaving, setIsSaving] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);

  const handleAIScanRecipe = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsIdentifying(true);
    try {
      const url = await uploadImage(file);
      const data = await analyzeImage(url, 'ingredient');

      // If AI returns an ingredient list, add it
      if (data.name) {
        setRecipeMaterials(prev => [
          ...prev,
          {
            id: Math.random().toString(),
            name: data.name,
            price: data.cost_per_unit || 0,
            qty: 1,
            unit: data.unit || 'pcs'
          }
        ]);
        toast.success(`AI berhasil menambahkan ${data.name}!`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal memindai resep');
    } finally {
      setIsIdentifying(false);
    }
  };

  // Helper for Info Tooltips
  const InfoTooltip = ({ content }: { content: string }) => (
    <Tooltip>
      <TooltipTrigger
        render={
          <button type="button" className="cursor-help outline-none group">
            <Info className="size-3 text-slate-600 group-hover:text-slate-600 transition-colors" />
          </button>
        }
      />
      <TooltipContent side="top" className="max-w-[200px] text-center">
        {content}
      </TooltipContent>
    </Tooltip>
  );

  useEffect(() => {
    if (batchId) {
      db.hpp_batches.get(batchId).then((batch) => {
        if (batch) {
          setStep(1);
          setBusinessModel(
            (batch.business_model === ("market_price" as any)
              ? "production"
              : batch.business_model || "production") as any,
          );
          setBusinessName(batch.name);
          setBatchPerMonth(batch.batch_qty);
          setServingSize(batch.serving_size || 1);

          setLabourCost(batch.labour_cost || 0);
          setLaborHours(batch.labor_hours || 0);
          setLaborRate(batch.labor_rate || 0);

          setWastagePct(batch.wastage_pct || 0);
          setContingencyPct(batch.contingency_pct || 0);
          setTaxIncluded(!!batch.tax_included);

          setShippingCost(batch.shipping_cost || 0);
          setTaxImportCost(batch.tax_import_cost || 0);
          setInsuranceCost(batch.insurance_cost || 0);
          setHandlingFee(batch.handling_fee || 0);

          setPackagingCost(batch.packaging_cost || 0);
          setMarketingInsertCost(batch.marketing_insert_cost || 0);

          setUtilityCosts(batch.utility_costs || 0);
          setMaintenanceCosts(batch.maintenance_costs || 0);

          // Restore new fields
          setAdsCost(batch.ads_cost || 0);
          setCodFeePct(batch.cod_fee_pct || 0);
          setReturnRatePct(batch.return_rate_pct || 0);
          setMarketplaceAdminFee(batch.marketplace_admin_fee || 0);
          setShippingSubsidy(batch.shipping_subsidy || 0);
          setCampaignFee(batch.campaign_fee || 0);

          setServiceDuration(batch.service_duration || 0);
          setServiceRate(batch.service_rate || 0);

          setMainMaterial({
            name: "",
            price: batch.raw_material_cost,
            qty: batch.raw_material_qty,
            unit: batch.raw_material_unit,
          });
          if (batch.recipe_materials) {
            setRecipeMaterials(
              batch.recipe_materials.map((m: any) => ({
                id: Math.random().toString(),
                ...m,
              })),
            );
          }
          setCosts(
            batch.additional_costs.map((c: any) => ({
              id: Math.random().toString(),
              name: c.name,
              price: c.price,
              period:
                c.period === "per_month"
                  ? "per_batch"
                  : c.period || "per_batch",
            })),
          );
          setDerivedProducts(
            batch.derived_products.map((p: any) => ({
              id: Math.random().toString(),
              name: p.name,
              qty: p.qty,
              unit: p.unit,
              price_sell: p.price_sell,
              target_profit: p.target_profit || "",
              selected_price: p.selected_price || "",
            })),
          );
        }
        setIsLoading(false);
      });
    }
  }, [batchId]);

  // Calculations
  const totalRawCost = useMemo(() => {
    return businessModel === "culinary"
      ? recipeMaterials.reduce((sum, m) => sum + (Number(m.price) || 0), 0)
      : Number(mainMaterial.price) || 0;
  }, [recipeMaterials, mainMaterial, businessModel]);

  const wastageAmount = useMemo(
    () => totalRawCost * (Number(wastagePct) / 100),
    [totalRawCost, wastagePct],
  );
  const contingencyAmount = useMemo(
    () => totalRawCost * (Number(contingencyPct) / 100),
    [totalRawCost, contingencyPct],
  );

  const calculatedLabor = useMemo(() => {
    const hourly = (Number(laborHours) || 0) * (Number(laborRate) || 0);
    return hourly > 0 ? hourly : Number(labourCost) || 0;
  }, [laborHours, laborRate, labourCost]);

  const totalLogistics = useMemo(() => {
    return (
      (Number(shippingCost) || 0) +
      (Number(taxImportCost) || 0) +
      (Number(insuranceCost) || 0) +
      (Number(handlingFee) || 0) +
      (Number(shippingSubsidy) || 0)
    );
  }, [
    shippingCost,
    taxImportCost,
    insuranceCost,
    handlingFee,
    shippingSubsidy,
  ]);

  const totalMarketingPackaging = useMemo(() => {
    return (
      (Number(packagingCost) || 0) +
      (Number(marketingInsertCost) || 0) +
      (Number(adsCost) || 0) +
      (Number(campaignFee) || 0)
    );
  }, [packagingCost, marketingInsertCost, adsCost, campaignFee]);

  const totalOverheadSpecific = useMemo(() => {
    const codAmount = (Number(codFeePct) / 100) * totalRawCost;
    const adminAmount = (Number(marketplaceAdminFee) / 100) * totalRawCost;
    return (
      (Number(utilityCosts) || 0) +
      (Number(maintenanceCosts) || 0) +
      codAmount +
      adminAmount
    );
  }, [
    utilityCosts,
    maintenanceCosts,
    codFeePct,
    marketplaceAdminFee,
    totalRawCost,
  ]);

  const totalDerivedQty = useMemo(() => {
    return derivedProducts.reduce((sum, p) => sum + (Number(p.qty) || 0), 0);
  }, [derivedProducts]);

  const totalProcessingCost = useMemo(() => {
    return costs.reduce((sum, c) => {
      const price = Number(c.price) || 0;
      const finalPrice =
        c.period === "per_produk_turunan" ? price * totalDerivedQty : price;
      return sum + finalPrice;
    }, 0);
  }, [costs, totalDerivedQty]);

  const totalProductionCost = useMemo(() => {
    const directCosts = totalRawCost + wastageAmount + contingencyAmount;
    const overheads =
      calculatedLabor +
      totalLogistics +
      totalMarketingPackaging +
      totalOverheadSpecific +
      totalProcessingCost;
    let final = directCosts + overheads;

    // Adjust for return rate (Ads/COD)
    if (Number(returnRatePct) > 0) {
      final = final * (1 + Number(returnRatePct) / 100);
    }

    if (taxIncluded) final = final * 1.11; // 11% PPN if toggled
    return final;
  }, [
    totalRawCost,
    wastageAmount,
    contingencyAmount,
    calculatedLabor,
    totalLogistics,
    totalMarketingPackaging,
    totalOverheadSpecific,
    totalProcessingCost,
    taxIncluded,
    returnRatePct,
  ]);

  const totalPotentialSales = useMemo(() => {
    return derivedProducts.reduce(
      (sum, p) => sum + (Number(p.qty) || 0) * (Number(p.price_sell) || 0),
      0,
    );
  }, [derivedProducts]);

  const profitLoss = totalPotentialSales - totalProductionCost;

  const hppPerProduct = useMemo(() => {
    if (totalPotentialSales === 0) return [];
    return derivedProducts.map((p) => {
      const qty = Number(p.qty) || 0;
      const priceSell = Number(p.price_sell) || 0;
      const revenueShare =
        totalPotentialSales === 0 ? 0 : (qty * priceSell) / totalPotentialSales;
      const allocatedCost = totalProductionCost * revenueShare;
      return {
        ...p,
        allocatedCost,
        revenueShare: revenueShare * 100,
        hpp: qty === 0 ? 0 : allocatedCost / qty,
      };
    });
  }, [derivedProducts, totalProductionCost, totalPotentialSales]);

  // Formatting Helpers
  const formatCurrency = (val: string | number) => {
    if (!val && val !== 0) return "";
    const num = val.toString().replace(/\D/g, "");
    return new Intl.NumberFormat("id-ID").format(Number(num));
  };

  const parseCurrency = (val: string) => {
    return val.replace(/\D/g, "");
  };

  const handleSave = async () => {
    if (!businessName) {
      toast.error("Masukkan nama bisnis/produk dulu ya");
      return;
    }

    if (!user?.id) {
      toast.error("Anda harus login untuk menyimpan data");
      return;
    }

    setIsSaving(true);
    try {
      const id = batchId || createId();
      const data: any = {
        id,
        user_id: user.id,
        business_model: businessModel,
        name: businessName,
        raw_material_id: "",
        raw_material_cost: totalRawCost,
        raw_material_qty: Number(mainMaterial.qty) || 0,
        raw_material_unit: mainMaterial.unit,
        batch_qty: Number(batchPerMonth) || 1,
        serving_size: Number(servingSize) || 1,
        wastage_pct: Number(wastagePct) || 0,
        contingency_pct: Number(contingencyPct) || 0,
        tax_included: taxIncluded,
        labour_cost: Number(labourCost) || 0,
        labor_hours: Number(laborHours) || 0,
        labor_rate: Number(laborRate) || 0,
        shipping_cost: Number(shippingCost) || 0,
        tax_import_cost: Number(taxImportCost) || 0,
        insurance_cost: Number(insuranceCost) || 0,
        handling_fee: Number(handlingFee) || 0,
        packaging_cost: Number(packagingCost) || 0,
        marketing_insert_cost: Number(marketingInsertCost) || 0,
        utility_costs: Number(utilityCosts) || 0,
        maintenance_costs: Number(maintenanceCosts) || 0,
        ads_cost: Number(adsCost) || 0,
        cod_fee_pct: Number(codFeePct) || 0,
        return_rate_pct: Number(returnRatePct) || 0,
        marketplace_admin_fee: Number(marketplaceAdminFee) || 0,
        shipping_subsidy: Number(shippingSubsidy) || 0,
        campaign_fee: Number(campaignFee) || 0,

        service_duration: Number(serviceDuration) || 0,
        service_rate: Number(serviceRate) || 0,
        recipe_materials:
          businessModel === "culinary"
            ? recipeMaterials.map((m) => ({
              name: m.name,
              price: Number(m.price) || 0,
              qty: Number(m.qty) || 1,
              unit: m.unit,
            }))
            : undefined,
        additional_costs: costs.map((c) => ({
          name: c.name,
          price: Number(c.price) || 0,
          period: c.period,
        })),
        derived_products: hppPerProduct.map((p) => ({
          name: p.name,
          qty: Number(p.qty) || 0,
          unit: p.unit,
          price_sell: Number(p.price_sell) || 0,
          allocation_pct: p.revenueShare,
          target_profit: Number(p.target_profit) || 0,
          selected_price: Number(p.selected_price) || 0,
        })),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        sync_status: "pending",
      };

      if (batchId) {
        await db.hpp_batches.put(data);
        await addToSyncQueue("hpp_batches", "update", data.id, data);
        toast.success("Perhitungan berhasil diperbarui!");
      } else {
        await db.hpp_batches.add(data);
        await addToSyncQueue("hpp_batches", "insert", data.id, data);
        toast.success("Perhitungan berhasil disimpan!");
      }

      router.push("/kalkulator-hpp");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Gagal menyimpan perhitungan");
    } finally {
      setIsSaving(false);
    }
  };

  // Actions
  const addCost = () =>
    setCosts([
      ...costs,
      {
        id: Math.random().toString(),
        name: "",
        price: "" as any,
        period: "per_batch",
      },
    ]);
  const removeCost = (id: string) => setCosts(costs.filter((c) => c.id !== id));

  const addProduct = () =>
    setDerivedProducts([
      ...derivedProducts,
      {
        id: Math.random().toString(),
        name: "",
        qty: "" as any,
        unit: "kg",
        price_sell: "" as any,
        target_profit: "",
        selected_price: "",
      },
    ]);
  const removeProduct = (id: string) =>
    setDerivedProducts(derivedProducts.filter((p) => p.id !== id));

  const handleAutoFill = () => {
    const names = [
      "Kopi Susu Gula Aren",
      "Keripik Tempe Balado",
      "Jasa Desain Logo",
      "Kaos Polos Premium",
      "Paket Catering Ultah",
    ];
    setBusinessName(names[Math.floor(Math.random() * names.length)]);
    setBatchPerMonth(Math.floor(Math.random() * 50) + 10);
    setServingSize(Math.floor(Math.random() * 5) + 1);

    setMainMaterial({
      name: "Bahan Baku Batch",
      price: Math.floor(Math.random() * 500000) + 50000,
      qty: Math.floor(Math.random() * 10) + 1,
      unit: "kg",
    });

    if (businessModel === "ads_cod") {
      setAdsCost(Math.floor(Math.random() * 1000000) + 100000);
      setCodFeePct(Math.floor(Math.random() * 5) + 2);
      setReturnRatePct(Math.floor(Math.random() * 10) + 5);
    } else if (businessModel === "marketplace") {
      setMarketplaceAdminFee(Math.floor(Math.random() * 6) + 2);
      setCampaignFee(Math.floor(Math.random() * 200000) + 20000);
      setShippingSubsidy(Math.floor(Math.random() * 50000) + 5000);
    } else if (businessModel === "culinary") {
      setRecipeMaterials([
        {
          id: Math.random().toString(),
          name: "Bahan A",
          price: 25000,
          qty: 1,
          unit: "kg",
        },
        {
          id: Math.random().toString(),
          name: "Bahan B",
          price: 15000,
          qty: 2,
          unit: "ltr",
        },
      ]);
    }

    setLabourCost(Math.floor(Math.random() * 200000) + 20000);
    setWastagePct(Math.floor(Math.random() * 5) + 1);
    setContingencyPct(Math.floor(Math.random() * 5) + 1);
    setPackagingCost(Math.floor(Math.random() * 50000) + 5000);

    setDerivedProducts([
      {
        id: Math.random().toString(),
        name: "Produk Varian 1",
        qty: 10,
        unit: "pcs",
        price_sell: 75000,
      },
    ]);

    toast.info("Data berhasil diisi otomatis untuk simulasi");
  };

  const handleAnalisaAI = async () => {
    setIsIdentifying(true);
    toast.info("AI sedang merancang simulasi bisnis untuk Anda...");
    try {
      const prompt = `Buatlah simulasi data perhitungan HPP (Harga Pokok Penjualan) untuk sebuah bisnis ${businessName ? `bernama "${businessName}"` : "yang menarik dan realistis"}. 
      Model operasional: ${businessModel || "produksi umum"}.
      Berikan HANYA JSON murni tanpa markdown atau teks penjelasan lain, dengan format seperti ini:
      {
        "business_name": "Nama Bisnis",
        "batch_per_month": 100,
        "serving_size": 1,
        "main_material_name": "Bahan Baku Utama",
        "main_material_price": 500000,
        "main_material_qty": 10,
        "main_material_unit": "kg",
        "labour_cost": 200000,
        "wastage_pct": 5,
        "contingency_pct": 5,
        "packaging_cost": 50000,
        "utility_costs": 100000,
        "product_name": "Produk Jadi",
        "product_qty": 50,
        "product_price_sell": 25000
      }`;

      const responseText = await analyzeText(prompt);
      let jsonStr = responseText;
      if (jsonStr.includes("\`\`\`json")) {
        jsonStr = jsonStr.split("\`\`\`json")[1].split("\`\`\`")[0].trim();
      } else if (jsonStr.includes("\`\`\`")) {
        jsonStr = jsonStr.split("\`\`\`")[1].split("\`\`\`")[0].trim();
      }

      const data = JSON.parse(jsonStr);

      setBusinessName(data.business_name || "Bisnis AI");
      setBatchPerMonth(data.batch_per_month || 100);
      setServingSize(data.serving_size || 1);

      setMainMaterial({
        name: data.main_material_name || "Bahan Baku Batch",
        price: data.main_material_price || 500000,
        qty: data.main_material_qty || 10,
        unit: data.main_material_unit || "kg"
      });

      if (businessModel === "ads_cod") {
        setAdsCost(Math.floor(Math.random() * 1000000) + 100000);
        setCodFeePct(Math.floor(Math.random() * 5) + 2);
        setReturnRatePct(Math.floor(Math.random() * 10) + 5);
      } else if (businessModel === "marketplace") {
        setMarketplaceAdminFee(Math.floor(Math.random() * 6) + 2);
        setCampaignFee(Math.floor(Math.random() * 200000) + 20000);
        setShippingSubsidy(Math.floor(Math.random() * 50000) + 5000);
      } else if (businessModel === "culinary") {
        setRecipeMaterials([
          {
            id: Math.random().toString(),
            name: data.main_material_name || "Bahan Utama",
            price: data.main_material_price || 50000,
            qty: data.main_material_qty || 1,
            unit: data.main_material_unit || "kg"
          }
        ]);
      }

      setLabourCost(data.labour_cost || 200000);
      setWastagePct(data.wastage_pct || 5);
      setContingencyPct(data.contingency_pct || 5);
      setPackagingCost(data.packaging_cost || 50000);
      setUtilityCosts(data.utility_costs || 100000);

      setDerivedProducts([
        {
          id: Math.random().toString(),
          name: data.product_name || "Produk Varian 1",
          qty: data.product_qty || 10,
          unit: "pcs",
          price_sell: data.product_price_sell || 75000,
        }
      ]);

      toast.success("AI berhasil mengisi data estimasi produksi!");
    } catch (error) {
      toast.error("Gagal menganalisa dengan AI. Coba lagi.");
      console.error(error);
    } finally {
      setIsIdentifying(false);
    }
  };

  if (step === 0) {
    const models = [
      {
        id: "ads_cod",
        name: "Iklan & COD",
        desc: "Fokus pada biaya marketing (FB/IG Ads) dan biaya COD/RTS.",
        icon: TrendingUp,
        color: "rose",
        tags: ["E-commerce", "Ads Performance"],
      },
      {
        id: "marketplace",
        name: "Marketplace",
        desc: "Hitung otomatis biaya admin, kampanye, dan subsidi ongkir.",
        icon: ShoppingBag,
        color: "indigo",
        tags: ["Shopee/Tokped", "Ritel"],
      },
      {
        id: "culinary",
        name: "Ritel / F&B",
        desc: "Manajemen resep & bahan baku dengan porsi presisi.",
        icon: Calculator,
        color: "indigo",
        tags: ["Resto", "Catering"],
      },
      {
        id: "quick",
        name: "Analisis Cepat",
        desc: "Kalkulasi kilat HPP & Harga Jual tanpa rincian rumit.",
        icon: Zap,
        color: "indigo",
        tags: ["Simulasi", "Quick Check"],
      },
      {
        id: "production",
        name: "Manufaktur",
        desc: "Pengolahan bahan mentah skala besar dengan overhead detail.",
        icon: Layers,
        color: "indigo",
        tags: ["Pabrik", "Processing"],
      },
      {
        id: "reseller",
        name: "Produksi Turunan",
        desc: "Satu proses produksi menghasilkan banyak varian produk.",
        icon: Package,
        color: "emerald",
        tags: ["Batching", "Varian"],
      },
      {
        id: "service",
        name: "Produk Jasa",
        desc: "Kalkulasi HPP berdasarkan jam kerja dan keahlian.",
        icon: Briefcase,
        color: "indigo",
        tags: ["Agensi", "Service"],
      },
    ];

    return (
      <SettingsLayout
        title="Pilih Model Operasional"
        subtitle="Kalkulator HPP"
        backUrl="/kalkulator-hpp"
      >
        <div className="w-full pt-8 pb-16 px-4 sm:px-10">
          <div className="max-w-7xl mx-auto mb-10 sm:mb-16 text-center sm:text-left">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em] mb-1">
                KasirHub HPP Engine v2.0
              </span>
              <h1 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tighter uppercase leading-[1.1] mb-4">
                Pilih Model <br /><span className="text-indigo-600">Operasional Bisnis</span>
              </h1>
              <p className="max-w-xl text-slate-500 font-bold text-[10px] sm:text-xs leading-relaxed uppercase tracking-widest opacity-60">
                Tentukan skenario perhitungan yang paling sesuai untuk mendapatkan akurasi finansial maksimal bagi usaha Anda.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-7xl mx-auto">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  setBusinessModel(model.id as any);
                  setStep(1);
                }}
                className="group bg-white border border-slate-200/60 p-4 sm:p-6 rounded-xl hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-100/50 transition-all text-left flex flex-col justify-between min-h-[180px] sm:min-h-[220px] relative overflow-hidden active:scale-95"
              >
                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between">
                    <div
                      className={cn(
                        "size-10 sm:size-12 rounded-lg flex items-center justify-center transition-all group-hover:scale-110 duration-500",
                        model.color === "indigo"
                          ? "bg-indigo-50 text-indigo-600 shadow-lg shadow-indigo-100/50"
                          : model.color === "emerald"
                            ? "bg-emerald-50 text-emerald-600 shadow-lg shadow-emerald-100/50"
                            : model.color === "rose"
                              ? "bg-rose-50 text-rose-600 shadow-lg shadow-rose-100/50"
                              : model.color === "orange"
                                ? "bg-orange-50 text-orange-600 shadow-lg shadow-orange-100/50"
                                : model.color === "amber"
                                  ? "bg-amber-50 text-amber-600 shadow-lg shadow-amber-100/50"
                                  : model.color === "yellow"
                                    ? "bg-yellow-50 text-yellow-600 shadow-lg shadow-yellow-100/50"
                                    : model.color === "blue"
                                      ? "bg-blue-50 text-blue-600 shadow-lg shadow-blue-100/50"
                                      : "bg-slate-50 text-slate-600",
                      )}
                    >
                      <model.icon className="size-5 sm:size-7" />
                    </div>
                    <div className="size-8 sm:size-10 rounded-xl bg-slate-50 group-hover:bg-indigo-600 text-slate-300 group-hover:text-white flex items-center justify-center transition-all">
                      <ArrowUpRight className="size-4 sm:size-5" />
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:space-y-3">
                    <h3 className="text-xs sm:text-base font-black text-slate-950 tracking-widest uppercase">
                      {model.name}
                    </h3>
                    <p className="text-[9px] sm:text-[11px] font-bold text-slate-400 leading-relaxed uppercase tracking-widest line-clamp-3 opacity-80">
                      {model.desc}
                    </p>
                  </div>
                </div>

                <div className="flex gap-1 flex-wrap mt-6 relative z-10">
                  {model.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="text-[8px] font-black uppercase tracking-widest text-indigo-600/60 bg-indigo-50/50 px-2 py-0.5 rounded-lg border border-indigo-100/50"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Subtle background decoration */}
                <model.icon className="absolute -right-8 -bottom-8 size-40 text-indigo-600 opacity-0 group-hover:opacity-[0.03] transition-all duration-700 rotate-12" />
              </button>
            ))}
          </div>
        </div>
      </SettingsLayout>
    );
  }

  const modelLabel = businessModel === "ads_cod"
    ? "Iklan & COD"
    : businessModel === "marketplace"
      ? "Marketplace"
      : businessModel === "service"
        ? "Produk Jasa"
        : businessModel === "quick"
          ? "Analisis Cepat"
          : "Kustom";

  return (
    <SettingsLayout
      title="Input Data Produksi"
      subtitle={`Model: ${modelLabel}`}
      backUrl="#"
      leftAction={
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-lg hover:bg-slate-50 transition-all active:scale-90 shrink-0"
          onClick={() => setStep(0)}
        >
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </Button>
      }
      rightAction={null}
    >
      <main className="w-full p-0 pb-20">
        <div className="space-y-4">
          {/* SECTION 1: HEADER DATA */}
          <div className="bg-white border-b border-slate-200">
            <div className="px-5 py-6 sm:px-6 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50/30 gap-4">
              <div className="flex flex-col">
                <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight uppercase">
                  Data Produksi
                </h2>
                <span className="text-[9px] sm:text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">
                  Konfigurasi HPP & Profitabilitas
                </span>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  onClick={handleAnalisaAI}
                  disabled={isIdentifying}
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none rounded-lg border-indigo-200 text-indigo-600 font-black text-[9px] uppercase tracking-widest gap-2 bg-white hover:bg-indigo-50 transition-all px-4 sm:px-6 h-9 sm:h-10 shadow-sm"
                >
                  {isIdentifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  Analisa AI
                </Button>
                <Button
                  onClick={handleAutoFill}
                  variant="ghost"
                  size="sm"
                  className="flex-1 sm:flex-none rounded-lg text-slate-600 font-black text-[9px] uppercase tracking-widest gap-2 bg-slate-100 hover:bg-slate-200 transition-all px-4 sm:px-6 h-9 sm:h-10"
                >
                  <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                  Auto-Fill
                </Button>
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-6 space-y-4">
            {/* CARD: DATA PRODUKSI */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                <div className="size-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-900 shadow-sm">
                  <LayoutGrid className="size-3" />
                </div>
                <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">
                  Informasi Utama Produk
                </h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nama Bisnis */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] ml-1">
                      Nama Bisnis / SKU
                    </Label>
                    <InfoTooltip content="Nama produk atau brand yang diproduksi/dijual." />
                  </div>
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center">
                      <Briefcase className="size-3.5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                    </div>
                    <Input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Masukkan nama bisnis..."
                      className="w-full h-11 pl-10 pr-4 border rounded-xl font-bold text-[13px] bg-slate-50/50 border-slate-100 focus:border-indigo-500 focus:bg-white text-slate-900 transition-all shadow-none"
                    />
                  </div>
                </div>

                {/* Target/Batch Qty */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] ml-1">
                      Target / Kapasitas Batch
                    </Label>
                    <InfoTooltip content="Jumlah unit yang dihasilkan dalam satu siklus produksi." />
                  </div>
                  <div className="relative group">
                    <Input
                      type="number"
                      value={batchPerMonth ?? ""}
                      onChange={(e) => setBatchPerMonth(e.target.value)}
                      className="w-full h-11 pl-4 pr-24 border rounded-xl font-black text-sm bg-slate-50/50 border-slate-100 focus:border-indigo-500 focus:bg-white text-slate-900 transition-all shadow-none"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-lg">
                      Unit / Batch
                    </div>
                  </div>
                </div>
              </div>
            </div>

          {/* SECTION: ADS & COD SPECIFIC */}
          {businessModel === "ads_cod" && (
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                  <div className="size-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-rose-600 shadow-sm">
                    <TrendingUp className="size-3" />
                  </div>
                  <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">
                    Konfigurasi Iklan & COD
                  </h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Budget Iklan */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-rose-400 tracking-[0.15em] ml-1">
                        Budget Iklan
                      </Label>
                      <InfoTooltip content="Total biaya yang dialokasikan untuk promosi berbayar." />
                    </div>
                    <div className="relative group">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-rose-600 text-[10px]">Rp</span>
                      <Input
                        value={formatCurrency(adsCost)}
                        onChange={(e) => setAdsCost(parseCurrency(e.target.value))}
                        className="w-full h-9 pl-8 pr-3 bg-white border border-rose-200 focus:border-rose-600 rounded-lg font-black text-xs shadow-none text-slate-700 transition-all"
                      />
                    </div>
                  </div>

                  {/* Fee COD */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] ml-1">
                        Fee COD (%)
                      </Label>
                      <InfoTooltip content="Persentase biaya penanganan untuk metode bayar di tempat." />
                    </div>
                    <div className="relative group">
                      <Input
                        type="number"
                        value={codFeePct ?? ""}
                        onChange={(e) => setCodFeePct(e.target.value)}
                        placeholder="0"
                        className="w-full h-9 pl-3 pr-8 border rounded-lg font-black text-xs bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                        %
                      </div>
                    </div>
                  </div>

                  {/* Resiko RTS */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] ml-1">
                        Resiko RTS (%)
                      </Label>
                      <InfoTooltip content="Estimasi persentase paket yang gagal kirim/kembali ke gudang." />
                    </div>
                    <div className="relative group">
                      <Input
                        type="number"
                        value={returnRatePct ?? ""}
                        onChange={(e) => setReturnRatePct(e.target.value)}
                        placeholder="0"
                        className="w-full h-9 pl-3 pr-8 border rounded-lg font-black text-xs bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                        %
                      </div>
                    </div>
                  </div>
              </div>
            </div>
          )}

          {/* SECTION: MARKETPLACE SPECIFIC */}
          {businessModel === "marketplace" && (
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                  <div className="size-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-orange-600 shadow-sm">
                    <ShoppingBag className="size-3" />
                  </div>
                  <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">
                    Konfigurasi Marketplace
                  </h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Admin Platform */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] ml-1">
                        Admin Platform (%)
                      </Label>
                      <InfoTooltip content="Potongan biaya dari platform marketplace (Shopee, Tokopedia, dll)." />
                    </div>
                    <div className="relative group">
                      <Input
                        type="number"
                        value={marketplaceAdminFee ?? ""}
                        onChange={(e) => setMarketplaceAdminFee(e.target.value)}
                        placeholder="0"
                        className="w-full h-9 pl-3 pr-8 border rounded-lg font-black text-xs bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                        %
                      </div>
                    </div>
                  </div>

                  {/* Biaya Kampanye */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-rose-400 tracking-[0.15em] ml-1">
                        Biaya Kampanye
                      </Label>
                      <InfoTooltip content="Biaya tambahan untuk mengikuti promo atau flash sale platform." />
                    </div>
                    <div className="relative group">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-rose-600 text-[10px]">Rp</span>
                      <Input
                        value={formatCurrency(campaignFee)}
                        onChange={(e) => setCampaignFee(parseCurrency(e.target.value))}
                        className="w-full h-9 pl-8 pr-3 bg-white border border-rose-200 focus:border-rose-600 rounded-lg font-black text-xs shadow-none text-slate-700 transition-all"
                      />
                    </div>
                  </div>

                  {/* Subsidi Ongkir */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-rose-400 tracking-[0.15em] ml-1">
                        Subsidi Ongkir
                      </Label>
                      <InfoTooltip content="Biaya ongkos kirim yang Anda tanggung (gratis ongkir)." />
                    </div>
                    <div className="relative group">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-rose-600 text-[10px]">Rp</span>
                      <Input
                        value={formatCurrency(shippingSubsidy)}
                        onChange={(e) => setShippingSubsidy(parseCurrency(e.target.value))}
                        className="w-full h-9 pl-8 pr-3 bg-white border border-rose-200 focus:border-rose-600 rounded-lg font-black text-xs shadow-none text-slate-700 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
          )}

          {/* SECTION: SERVICE SPECIFIC */}
          {businessModel === "service" && (
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                  <div className="size-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm">
                    <Briefcase className="size-3" />
                  </div>
                  <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">
                    Konfigurasi Produk Jasa
                  </h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Durasi */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] ml-1">
                        Durasi (Jam)
                      </Label>
                      <InfoTooltip content="Total waktu yang dibutuhkan untuk menyelesaikan jasa." />
                    </div>
                    <div className="relative group">
                      <Input
                        type="number"
                        value={serviceDuration ?? ""}
                        onChange={(e) => setServiceDuration(e.target.value)}
                        className="w-full h-9 pl-3 pr-12 border rounded-lg font-black text-xs bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Jam
                      </div>
                    </div>
                  </div>

                  {/* Rate Per Jam */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-rose-400 tracking-[0.15em] ml-1">
                        Rate Per Jam
                      </Label>
                      <InfoTooltip content="Nilai upah atau biaya operasional per satu jam kerja." />
                    </div>
                    <div className="relative group">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-rose-600 text-[10px]">Rp</span>
                      <Input
                        value={formatCurrency(serviceRate)}
                        onChange={(e) => setServiceRate(parseCurrency(e.target.value))}
                        className="w-full h-9 pl-8 pr-3 bg-white border border-rose-200 focus:border-rose-600 rounded-lg font-black text-xs shadow-none text-slate-700 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

          )}

          {/* CARD: EFISIENSI & PAJAK */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="size-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-900 shadow-sm">
                    <TrendingUp className="size-3" />
                  </div>
                  <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">
                    Efisiensi & Pajak
                  </h2>
                </div>
                <div className="flex items-center gap-4 bg-white px-3 py-1.5 rounded-md border border-slate-100 shadow-sm">
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                    Include PPN?
                  </span>
                  <button
                    onClick={() => setTaxIncluded(!taxIncluded)}
                    className={cn(
                      "w-8 h-4 rounded-full transition-all relative",
                      taxIncluded ? "bg-indigo-600" : "bg-slate-200",
                    )}
                  >
                    <div
                      className={cn(
                        "size-3 bg-white rounded-full absolute top-0.5 transition-all shadow-sm",
                        taxIncluded ? "right-0.5" : "left-0.5",
                      )}
                    />
                  </button>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Tak Terduga */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] ml-1">
                      Tak Terduga
                    </Label>
                    <InfoTooltip content="Dana cadangan untuk biaya mendadak di luar rencana." />
                  </div>
                  <div className="relative group">
                    <Input
                      type="number"
                      value={contingencyPct ?? ""}
                      onChange={(e) => setContingencyPct(e.target.value)}
                      placeholder="0"
                      className="w-full h-9 pl-3 pr-8 border rounded-lg font-black text-xs bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                      %
                    </div>
                  </div>
                </div>

                {/* Wastage */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] ml-1">
                      Wastage
                    </Label>
                    <InfoTooltip content="Persentase bahan baku yang menyusut atau terbuang." />
                  </div>
                  <div className="relative group">
                    <Input
                      type="number"
                      value={wastagePct ?? ""}
                      onChange={(e) => setWastagePct(e.target.value)}
                      placeholder="0"
                      className="w-full h-9 pl-3 pr-8 border rounded-lg font-black text-xs bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                      %
                    </div>
                  </div>
                </div>

                {/* Porsi / Batch */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] ml-1">
                      Porsi / Unit Hasil
                    </Label>
                    <InfoTooltip content="Berapa banyak porsi/unit yang dihasilkan dalam resep ini." />
                  </div>
                  <div className="relative group">
                    <Input
                      type="number"
                      value={servingSize ?? ""}
                      onChange={servingSize ? (e) => setServingSize(e.target.value) : undefined}
                      placeholder="1"
                      className="w-full h-9 pl-3 pr-16 border rounded-lg font-black text-xs bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Porsi
                    </div>
                  </div>
                </div>
              </div>
            </div>

          {/* CARD: BAHAN BAKU & KEMASAN */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="size-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-900 shadow-sm">
                    <Package className="size-3" />
                  </div>
                  <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">
                    {businessModel === "culinary" ? "Bahan Baku & Resep" : "Bahan Utama"}
                  </h2>
                </div>
                {businessModel === "culinary" && (
                  <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded uppercase">
                    BOM List
                  </span>
                )}
              </div>

              <div className="px-6 py-3 bg-slate-50/30 border-b border-slate-100 grid grid-cols-12 gap-4">
                <div className="col-span-5 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                  Item
                </div>
                <div className="col-span-4 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                  Harga
                </div>
                <div className="col-span-2 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-center">
                  Unit
                </div>
                <div className="col-span-1"></div>
              </div>

              <div className="p-6">
                {businessModel === "culinary" ? (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      {recipeMaterials.map((mat) => (
                        <div
                          key={mat.id}
                          className="grid grid-cols-12 gap-3 items-center group"
                        >
                          <div className="col-span-5">
                            <Input
                              value={mat.name}
                              onChange={(e) =>
                                setRecipeMaterials(
                                  recipeMaterials.map((m) =>
                                    m.id === mat.id
                                      ? { ...m, name: e.target.value }
                                      : m,
                                  ),
                                )
                              }
                              className="w-full h-9 px-3 border rounded-lg font-medium text-[11px] bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none"
                              placeholder="Nama bahan..."
                            />
                          </div>
                          <div className="col-span-4">
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400 text-[10px]">Rp</span>
                              <Input
                                value={formatCurrency(mat.price)}
                                onChange={(e) =>
                                  setRecipeMaterials(
                                    recipeMaterials.map((m) =>
                                      m.id === mat.id
                                        ? {
                                          ...m,
                                          price: parseCurrency(e.target.value),
                                        }
                                        : m,
                                    ),
                                  )
                                }
                                className="w-full h-9 pl-8 pr-3 border rounded-lg font-black text-xs bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none"
                              />
                            </div>
                          </div>
                          <div className="col-span-2">
                            <Input
                              value={mat.unit}
                              onChange={(e) =>
                                setRecipeMaterials(
                                  recipeMaterials.map((m) =>
                                    m.id === mat.id
                                      ? { ...m, unit: e.target.value }
                                      : m,
                                  ),
                                )
                              }
                              className="w-full h-9 px-2 border rounded-lg font-black text-[11px] text-center bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none uppercase"
                              placeholder="pcs"
                            />
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <button
                              onClick={() =>
                                setRecipeMaterials(
                                  recipeMaterials.filter(
                                    (m) => m.id !== mat.id,
                                  ),
                                )
                              }
                              className="text-slate-300 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                      <button
                        onClick={() =>
                          setRecipeMaterials([
                            ...recipeMaterials,
                            {
                              id: Math.random().toString(),
                              name: "",
                              price: "",
                              qty: 1,
                              unit: "pcs",
                            },
                          ])
                        }
                        className="flex items-center justify-center gap-2 text-slate-500 hover:text-slate-950 font-black text-[10px] uppercase tracking-widest py-4 border border-dashed border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
                      >
                        <Plus className="h-4 w-4" />
                        Tambah Bahan Baku
                      </button>

                      <div className="relative flex gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id="ai-recipe-scan"
                          onChange={handleAIScanRecipe}
                        />
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          id="ai-recipe-camera"
                          onChange={handleAIScanRecipe}
                        />
                        <button
                          onClick={() => document.getElementById('ai-recipe-scan')?.click()}
                          disabled={isIdentifying}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest py-4 border-2 border-dashed rounded-lg transition-all",
                            isIdentifying
                              ? "bg-indigo-50 border-indigo-200 text-indigo-600 animate-pulse"
                              : "text-indigo-600 border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50/50 group"
                          )}
                        >
                          {isIdentifying ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <LayoutGrid className="h-4 w-4 group-hover:scale-110 transition-transform" />
                          )}
                          {isIdentifying ? "AI Analizing..." : "Galeri"}
                        </button>
                        <button
                          onClick={() => document.getElementById('ai-recipe-camera')?.click()}
                          disabled={isIdentifying}
                          className={cn(
                            "w-14 flex items-center justify-center border-2 border-dashed rounded-lg transition-all shrink-0",
                            isIdentifying
                              ? "bg-indigo-50 border-indigo-200 text-indigo-400 animate-pulse"
                              : "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700"
                          )}
                        >
                          <Camera className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                    <div className="space-y-1.5 md:col-span-1">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] ml-1">
                          Bahan Utama
                        </Label>
                      </div>
                      <div className="relative group">
                        <Input
                          value={mainMaterial.name}
                          onChange={(e) => setMainMaterial({ ...mainMaterial, name: e.target.value })}
                          placeholder="Nama bahan..."
                          className="w-full h-9 pl-3 pr-3 border rounded-lg font-medium text-[11px] bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 md:col-span-1">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-rose-400 tracking-[0.15em] ml-1">
                          Harga Total
                        </Label>
                      </div>
                      <div className="relative group">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-rose-600 text-[10px]">Rp</span>
                        <Input
                          value={formatCurrency(mainMaterial.price)}
                          onChange={(e) => setMainMaterial({ ...mainMaterial, price: parseCurrency(e.target.value) })}
                          className="w-full h-9 pl-8 pr-3 bg-white border border-rose-200 focus:border-rose-600 rounded-lg font-black text-xs shadow-none text-slate-700 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 md:col-span-1">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] ml-1">
                          Satuan
                        </Label>
                      </div>
                      <div className="relative group">
                        <Input
                          value={mainMaterial.unit}
                          onChange={(e) => setMainMaterial({ ...mainMaterial, unit: e.target.value })}
                          className="w-full h-9 px-3 border rounded-lg font-black text-xs bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          {/* CARD: TENAGA KERJA */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="size-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shadow-sm">
                    <Briefcase className="size-3" />
                  </div>
                  <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">
                    Tenaga Kerja
                  </h2>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Upah Borongan */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 select-none text-[8px] font-black uppercase text-emerald-700 tracking-[0.1em] ml-1">
                      Upah Borongan / Batch
                    </Label>
                    <InfoTooltip content="Upah tetap yang dibayarkan per satu siklus batch selesai." />
                  </div>
                  <div className="relative group">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-emerald-600 text-[10px]">Rp</span>
                    <Input
                      value={formatCurrency(labourCost)}
                      onChange={(e) => setLabourCost(parseCurrency(e.target.value))}
                      className="w-full h-9 pl-8 pr-3 bg-white border border-emerald-200 focus:border-emerald-600 rounded-lg font-black text-xs shadow-none text-slate-700 transition-all"
                    />
                  </div>
                </div>

                {/* Sistem Jam - Jam */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] ml-1">
                      Durasi (Jam)
                    </Label>
                    <InfoTooltip content="Biaya tenaga kerja dihitung berdasarkan durasi waktu." />
                  </div>
                  <div className="relative group">
                    <Input
                      type="number"
                      value={laborHours ?? ""}
                      onChange={(e) => setLaborHours(e.target.value)}
                      placeholder="0"
                      className="w-full h-9 pl-3 pr-10 border rounded-lg font-black text-xs bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Jam
                    </div>
                  </div>
                </div>

                {/* Sistem Jam - Rate */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 select-none text-[8px] font-black uppercase text-emerald-700 tracking-[0.1em] ml-1">
                      Rate / Jam
                    </Label>
                    <InfoTooltip content="Biaya tenaga kerja per satu jam kerja." />
                  </div>
                  <div className="relative group">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-emerald-600 text-[10px]">Rp</span>
                    <Input
                      value={formatCurrency(laborRate)}
                      onChange={(e) => setLaborRate(parseCurrency(e.target.value))}
                      className="w-full h-9 pl-8 pr-3 bg-white border border-emerald-200 focus:border-emerald-600 rounded-lg font-black text-xs shadow-none text-slate-700 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

          {/* CARD: BIAYA OPERASIONAL & OVERHEADS */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="size-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm">
                    <Wallet className="size-3" />
                  </div>
                  <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">
                    Biaya Operasional & Overheads
                  </h2>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Reseller Logistics */}
                {businessModel === "reseller" && (
                  <div className="px-6 py-6 space-y-4">
                    <h3 className="text-[10px] font-black text-slate-950 uppercase tracking-widest flex items-center gap-2">
                      Logistik & Import{" "}
                      <InfoTooltip content="Biaya pengiriman barang dari vendor atau biaya cukai." />
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-rose-400 tracking-[0.15em] ml-1">
                            Ongkir Masuk
                          </Label>
                        </div>
                        <div className="relative group">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-rose-600 text-[10px]">Rp</span>
                          <Input
                            value={formatCurrency(shippingCost)}
                            onChange={(e) => setShippingCost(parseCurrency(e.target.value))}
                            className="w-full h-9 pl-8 pr-3 bg-white border border-rose-200 focus:border-rose-600 rounded-lg font-black text-xs shadow-none text-slate-700 transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-rose-400 tracking-[0.15em] ml-1">
                            Pajak / Bea Cukai
                          </Label>
                        </div>
                        <div className="relative group">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-rose-600 text-[10px]">Rp</span>
                          <Input
                            value={formatCurrency(taxImportCost)}
                            onChange={(e) => setTaxImportCost(parseCurrency(e.target.value))}
                            className="w-full h-9 pl-8 pr-3 bg-white border border-rose-200 focus:border-rose-600 rounded-lg font-black text-xs shadow-none text-slate-700 transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-rose-400 tracking-[0.15em] ml-1">
                            Asuransi
                          </Label>
                        </div>
                        <div className="relative group">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-rose-600 text-[10px]">Rp</span>
                          <Input
                            value={formatCurrency(insuranceCost)}
                            onChange={(e) => setInsuranceCost(parseCurrency(e.target.value))}
                            className="w-full h-9 pl-8 pr-3 bg-white border border-rose-200 focus:border-rose-600 rounded-lg font-black text-xs shadow-none text-slate-700 transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-rose-400 tracking-[0.15em] ml-1">
                            Handling
                          </Label>
                        </div>
                        <div className="relative group">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-rose-600 text-[10px]">Rp</span>
                          <Input
                            value={formatCurrency(handlingFee)}
                            onChange={(e) => setHandlingFee(parseCurrency(e.target.value))}
                            className="w-full h-9 pl-8 pr-3 bg-white border border-rose-200 focus:border-rose-600 rounded-lg font-black text-xs shadow-none text-slate-700 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Production/Culinary Overheads */}
                {(businessModel === "production" ||
                  businessModel === "culinary") && (
                    <div className="px-6 py-6 space-y-4">
                      <h3 className="text-[10px] font-black text-slate-950 uppercase tracking-widest flex items-center gap-2">
                        Utilitas & Alat{" "}
                        <InfoTooltip content="Biaya listrik, air, gas, dan penyusutan peralatan." />
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-rose-400 tracking-[0.15em] ml-1">
                              Listrik / Gas / Air
                            </Label>
                          </div>
                          <div className="relative group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-rose-600 text-[10px]">Rp</span>
                            <Input
                              value={formatCurrency(utilityCosts)}
                              onChange={(e) => setUtilityCosts(parseCurrency(e.target.value))}
                              className="w-full h-9 pl-8 pr-3 bg-white border border-rose-200 focus:border-rose-600 rounded-lg font-black text-xs shadow-none text-slate-700 transition-all"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-rose-400 tracking-[0.15em] ml-1">
                              Sewa / Penyusutan
                            </Label>
                          </div>
                          <div className="relative group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-rose-600 text-[10px]">Rp</span>
                            <Input
                              value={formatCurrency(maintenanceCosts)}
                              onChange={(e) => setMaintenanceCosts(parseCurrency(e.target.value))}
                              className="w-full h-9 pl-8 pr-3 bg-white border border-rose-200 focus:border-rose-600 rounded-lg font-black text-xs shadow-none text-slate-700 transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Packaging & Marketing */}
                <div className="px-4 py-6 space-y-4">
                  <h3 className="text-[10px] font-black text-slate-950 uppercase tracking-widest flex items-center gap-2">
                    Packaging & Marketing{" "}
                    <InfoTooltip content="Biaya kemasan, stiker, kartu ucapan, dan promosi." />
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-rose-400 tracking-[0.15em] ml-1">
                          Box / Plastik
                        </Label>
                      </div>
                      <div className="relative group">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-rose-600 text-[10px]">Rp</span>
                        <Input
                          value={formatCurrency(packagingCost)}
                          onChange={(e) => setPackagingCost(parseCurrency(e.target.value))}
                          className="w-full h-9 pl-8 pr-3 bg-white border border-rose-200 focus:border-rose-600 rounded-lg font-black text-xs shadow-none text-slate-700 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 select-none text-[10px] font-black uppercase text-rose-400 tracking-[0.15em] ml-1">
                          Stiker / Kartu / Promosi
                        </Label>
                      </div>
                      <div className="relative group">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-rose-600 text-[10px]">Rp</span>
                        <Input
                          value={formatCurrency(marketingInsertCost)}
                          onChange={(e) => setMarketingInsertCost(parseCurrency(e.target.value))}
                          className="w-full h-9 pl-8 pr-3 bg-white border border-rose-200 focus:border-rose-600 rounded-lg font-black text-xs shadow-none text-slate-700 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          {/* CARD: BIAYA OPERASIONAL LAIN */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-3">
                              <div className="size-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm">
                                <Plus className="size-3" />
                              </div>
                              <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">
                                Biaya Operasional Lain
                              </h2>
                            </div>
                            <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded uppercase">
                              Custom Overheads
                            </span>
                          </div>

                          <div className="px-6 py-3 bg-slate-50/30 border-b border-slate-100 grid grid-cols-12 gap-4">
                            <div className="col-span-5 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                              Keterangan
                            </div>
                            <div className="col-span-4 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                              Nominal
                            </div>
                            <div className="col-span-2 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-center">
                              Tipe
                            </div>
                            <div className="col-span-1"></div>
                          </div>

                          <div className="p-6">
                            <div className="space-y-3">
                              {costs.map((cost) => (
                                <div
                                  key={cost.id}
                                  className="grid grid-cols-12 gap-4 items-center group"
                                >
                                  <div className="col-span-5">
                                    <Input
                                      value={cost.name}
                                      onChange={(e) =>
                                        setCosts(
                                          costs.map((c) =>
                                            c.id === cost.id
                                              ? { ...c, name: e.target.value }
                                              : c,
                                          ),
                                        )
                                      }
                                      className="w-full h-10 px-3 border rounded-lg font-medium text-[11px] bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none"
                                      placeholder="Nama biaya..."
                                    />
                                  </div>
                                  <div className="col-span-4">
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400 text-[10px]">Rp</span>
                                      <Input
                                        value={formatCurrency(cost.price)}
                                        onChange={(e) =>
                                          setCosts(
                                            costs.map((c) =>
                                              c.id === cost.id
                                                ? {
                                                  ...c,
                                                  price: parseCurrency(e.target.value),
                                                }
                                                : c,
                                            ),
                                          )
                                        }
                                        className="w-full h-10 pl-8 pr-3 border rounded-lg font-black text-xs bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none"
                                      />
                                    </div>
                                  </div>
                                  <div className="col-span-2">
                                    <Select
                                      value={cost.period}
                                      onValueChange={(v: any) =>
                                        setCosts(
                                          costs.map((c) =>
                                            c.id === cost.id ? { ...c, period: v } : c,
                                          ),
                                        )
                                      }
                                    >
                                      <SelectTrigger className="w-full h-10 px-2 border rounded-lg font-black text-[10px] bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none uppercase tracking-widest text-center">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem
                                          value="per_batch"
                                          className="font-black text-[10px] uppercase"
                                        >
                                          Batch
                                        </SelectItem>
                                        <SelectItem
                                          value="per_produk_turunan"
                                          className="font-black text-[10px] uppercase"
                                        >
                                          Unit
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="col-span-1 flex justify-end">
                                    <button
                                      onClick={() => removeCost(cost.id)}
                                      className="text-slate-300 hover:text-rose-500 transition-colors"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}

                              <button
                                onClick={addCost}
                                className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-950 font-black text-[10px] uppercase tracking-widest py-4 border border-dashed border-slate-200 rounded-lg hover:bg-slate-50 transition-all mt-2"
                              >
                                <Plus className="h-4 w-4" />
                                Tambah Biaya Operasional
                              </button>
                            </div>
                          </div>
              </div>

          {/* CARD: PRODUK TURUNAN */}
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                          <div className="flex items-center gap-3">
                            <div className="size-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm">
                              <Target className="size-3" />
                            </div>
                            <h2 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em]">
                              {businessModel === "reseller" ? "Varian Jual" : "Produk Jadi"}
                            </h2>
                          </div>
                          <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded uppercase">
                            Output Produksi
                          </span>
                        </div>

                        <div className="px-6 py-3 bg-slate-50/30 border-b border-slate-100 grid grid-cols-12 gap-4">
                          <div className="col-span-4 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                            Nama Varian
                          </div>
                          <div className="col-span-2 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-center">
                            Qty
                          </div>
                          <div className="col-span-2 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-center">
                            Unit
                          </div>
                          <div className="col-span-3 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                            Harga
                          </div>
                          <div className="col-span-1"></div>
                        </div>

                        <div className="p-6">
                          <div className="space-y-3">
                            {derivedProducts.map((prod) => (
                              <div
                                key={prod.id}
                                className="grid grid-cols-12 gap-3 items-center group"
                              >
                                <div className="col-span-4">
                                  <Input
                                    value={prod.name}
                                    onChange={(e) =>
                                      setDerivedProducts(
                                        derivedProducts.map((p) =>
                                          p.id === prod.id
                                            ? { ...p, name: e.target.value }
                                            : p,
                                        ),
                                      )
                                    }
                                    className="w-full h-10 px-3 border rounded-lg font-medium text-[11px] bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Input
                                    type="number"
                                    value={prod.qty ?? ""}
                                    onChange={(e) =>
                                      setDerivedProducts(
                                        derivedProducts.map((p) =>
                                          p.id === prod.id
                                            ? { ...p, qty: e.target.value }
                                            : p,
                                        ),
                                      )
                                    }
                                    className="w-full h-10 px-2 border rounded-lg font-black text-xs text-center bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Input
                                    value={prod.unit}
                                    onChange={(e) =>
                                      setDerivedProducts(
                                        derivedProducts.map((p) =>
                                          p.id === prod.id
                                            ? { ...p, unit: e.target.value }
                                            : p,
                                        ),
                                      )
                                    }
                                    className="w-full h-10 px-2 border rounded-lg font-black text-[11px] text-center bg-slate-50 border-slate-200 focus:border-indigo-600 focus:bg-white text-indigo-700 transition-all shadow-none uppercase"
                                  />
                                </div>
                                <div className="col-span-3">
                                  <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 font-black text-emerald-600 text-[9px]">Rp</span>
                                    <Input
                                      value={formatCurrency(prod.price_sell)}
                                      onChange={(e) =>
                                        setDerivedProducts(
                                          derivedProducts.map((p) =>
                                            p.id === prod.id
                                              ? {
                                                ...p,
                                                price_sell: parseCurrency(
                                                  e.target.value,
                                                ),
                                              }
                                              : p,
                                          ),
                                        )
                                      }
                                      className="w-full h-10 pl-6 pr-2 border rounded-lg font-black text-xs text-emerald-700 bg-emerald-50 border-emerald-200 focus:border-emerald-600 focus:bg-white transition-all shadow-none text-right"
                                    />
                                  </div>
                                </div>
                                <div className="col-span-1 flex justify-end">
                                  <button
                                    onClick={() => removeProduct(prod.id)}
                                    className="text-slate-300 hover:text-rose-500 transition-colors"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))}

                            <button
                              onClick={addProduct}
                              className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-950 font-black text-[10px] uppercase tracking-widest py-4 border border-dashed border-slate-200 rounded-lg hover:bg-slate-50 transition-all mt-2"
                            >
                              <Plus className="h-4 w-4" />
                              Tambah Varian Produk
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

        <div className="p-6 flex justify-center bg-slate-50/50 border-t border-slate-200">
          <Button
            onClick={() => setShowResults(true)}
            className="w-full max-w-sm h-14 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-indigo-100 gap-3 text-base group"
          >
            <Calculator className="h-5 w-5 group-hover:rotate-12 transition-transform" />
            Hitung HPP Sekarang
          </Button>
        </div>

      {/* SECTION 2: HASIL PERHITUNGAN */}
      {showResults && (
        <div className="bg-slate-50/50 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-12">
          {/* HEADER: ANALISIS HASIL */}
          <div className="px-5 py-8 sm:px-10 sm:py-12 bg-white border-b border-slate-100">
            <div className="max-w-4xl mx-auto text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 mb-1">
                <div className="size-1 rounded-full bg-indigo-600 animate-pulse" />
                <span className="text-[8px] sm:text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Live Analysis Report</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight uppercase leading-tight">
                Hasil Analisis <span className="text-indigo-600">Finansial</span>
              </h2>
              <p className="text-[10px] sm:text-sm text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed px-4">
                Berdasarkan data produksi yang Anda input, berikut adalah proyeksi performa bisnis Anda untuk batch ini.
              </p>
            </div>
          </div>

          {/* MAIN METRICS CARDS */}
          <div className="px-4 sm:px-10 -mt-6 sm:-mt-8 relative z-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 max-w-6xl mx-auto">
              {/* Card 1: Biaya Produksi */}
              <div className="bg-white rounded-lg border border-slate-100 p-5 sm:p-6 shadow-lg shadow-slate-200/40 flex flex-col justify-between group hover:border-indigo-200 transition-all">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="size-10 sm:size-12 rounded-lg sm:rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                    <Package className="size-5 sm:size-6" />
                  </div>
                  <InfoTooltip content="Total seluruh biaya produksi dari bahan hingga overhead." />
                </div>
                <div>
                  <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Total Pengeluaran</span>
                  <div className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    <span className="text-xs sm:text-sm text-slate-300 mr-1 sm:mr-1.5 font-bold">Rp</span>
                    {Math.round(totalProductionCost).toLocaleString("id-ID")}
                  </div>
                </div>
              </div>

              {/* Card 2: Potensi Omzet */}
              <div className="bg-white rounded-lg border border-slate-100 p-5 sm:p-6 shadow-lg shadow-slate-200/40 flex flex-col justify-between group hover:border-emerald-200 transition-all">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="size-10 sm:size-12 rounded-lg sm:rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                    <TrendingUp className="size-5 sm:size-6" />
                  </div>
                  <InfoTooltip content="Estimasi total pendapatan jika seluruh produk terjual habis." />
                </div>
                <div>
                  <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Potensi Omzet</span>
                  <div className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    <span className="text-xs sm:text-sm text-slate-300 mr-1 sm:mr-1.5 font-bold">Rp</span>
                    {Math.round(totalPotentialSales).toLocaleString("id-ID")}
                  </div>
                </div>
              </div>

              {/* Card 3: Laba Bersih */}
              <div className={cn(
                "rounded-lg border p-5 sm:p-6 shadow-lg flex flex-col justify-between transition-all",
                profitLoss >= 0 
                  ? "bg-indigo-600 border-indigo-500 shadow-indigo-200 text-white" 
                  : "bg-rose-600 border-rose-500 shadow-rose-200 text-white"
              )}>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="size-10 sm:size-12 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                    <Calculator className="size-5 sm:size-6" />
                  </div>
                  <div className="bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest">
                    {profitLoss >= 0 
                      ? `${((profitLoss / totalPotentialSales) * 100).toFixed(1)}% Margin` 
                      : "Loss Identified"}
                  </div>
                </div>
                <div>
                  <span className="text-[9px] sm:text-[10px] font-black text-white/60 uppercase tracking-widest mb-1 block">Proyeksi Laba</span>
                  <div className="text-xl sm:text-3xl font-black tracking-tight">
                    <span className="text-xs sm:text-sm text-white/40 mr-1 sm:mr-1.5 font-bold">Rp</span>
                    {Math.round(profitLoss).toLocaleString("id-ID")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI INSIGHTS SECTION */}
          <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-6xl mx-auto">
            <div className="bg-white rounded-lg border border-slate-100 overflow-hidden shadow-xl shadow-slate-200/40">
              <div className="grid grid-cols-1 lg:grid-cols-12">
                {/* Left: AI Branding */}
                <div className="lg:col-span-4 bg-indigo-600 p-6 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="size-8 sm:size-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-4 sm:mb-6">
                      <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight leading-tight mb-2">
                      Smart AI<br className="hidden sm:block" /> Recommendations
                    </h3>
                    <p className="text-[10px] sm:text-xs text-indigo-100 font-medium leading-relaxed opacity-80">
                      Analisis otomatis berdasarkan algoritma finansial KasirHub.
                    </p>
                  </div>
                  <div className="mt-6 sm:mt-10 relative z-10">
                    <Badge className={cn(
                      "text-[8px] sm:text-[10px] font-black px-2.5 py-1 uppercase tracking-widest border-0",
                      profitLoss > 0 ? "bg-emerald-400 text-emerald-950" : "bg-rose-400 text-rose-950"
                    )}>
                      {profitLoss > 0 ? "Health: Optimal" : "Action Required"}
                    </Badge>
                  </div>
                  {/* Decorative AI circles */}
                  <div className="absolute -right-10 -bottom-10 size-32 sm:size-40 bg-white/10 rounded-full blur-3xl" />
                  <div className="absolute -left-10 top-0 size-24 sm:size-32 bg-indigo-400/20 rounded-full blur-2xl" />
                </div>

                {/* Right: Insights Content */}
                <div className="lg:col-span-8 p-6 sm:p-10 bg-white">
                  <div className="space-y-4 sm:space-y-6">
                    <div className="flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-lg sm:rounded-2xl bg-slate-50 border border-slate-100 group hover:border-indigo-200 transition-all">
                      <div className="size-8 sm:size-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
                      </div>
                      <div>
                        <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Rekomendasi Strategis</span>
                        <p className="text-xs sm:text-base font-bold text-slate-900 leading-relaxed">
                          {profitLoss > 0
                            ? "Bisnis Anda berada dalam jalur profit yang sehat. Fokus pada optimalisasi distribusi untuk menjaga perputaran stok."
                            : "Margin Anda terlalu tipis atau negatif. Segera tinjau ulang biaya bahan baku atau naikkan harga jual minimal 15%."}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl border border-slate-100 flex items-center gap-3">
                        <div className="size-7 sm:size-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                          <CheckCircle2 className="size-3.5 sm:size-4 text-emerald-600" />
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold text-slate-600">Efisiensi Bahan: <span className="text-slate-950">92%</span></span>
                      </div>
                      <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl border border-slate-100 flex items-center gap-3">
                        <div className="size-7 sm:size-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                          <Target className="size-3.5 sm:size-4 text-indigo-600" />
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold text-slate-600">Target ROI: <span className="text-slate-950">1.4x</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* COST BREAKDOWN SECTION */}
          <div className="px-4 sm:px-10 py-4 sm:py-6 max-w-6xl mx-auto">
            <div className="bg-white rounded-lg border border-slate-100 p-6 sm:p-10 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-slate-100">
                <div className="flex flex-col">
                  <h3 className="text-[9px] sm:text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-1">Cost Structure</h3>
                  <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">Rincian Pengeluaran</span>
                </div>
                <div className="size-8 sm:size-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                  <Layers className="size-4 sm:size-5" />
                </div>
              </div>

              <div className="space-y-1">
                {/* Header Row */}
                <div className="flex justify-between pb-3 sm:pb-4 mb-3 sm:mb-4 items-center border-b border-slate-100/50">
                  <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Kategori Komponen</span>
                  <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Nilai Rupiah</span>
                </div>

                {/* Costs Rows */}
                <div className="space-y-3 sm:space-y-4">
                  {[
                    { label: "Bahan Baku Utama", value: totalRawCost, variant: "primary" },
                    { label: `Wastage (${wastagePct}%)`, value: wastageAmount, variant: "danger", show: wastageAmount > 0 },
                    { label: `Tak Terduga (${contingencyPct}%)`, value: contingencyAmount, variant: "warning", show: contingencyAmount > 0 },
                    { label: "Tenaga Kerja", value: calculatedLabor, variant: "primary", show: calculatedLabor > 0 },
                    { label: "Logistik & Pajak", value: totalLogistics, variant: "primary", show: totalLogistics > 0 },
                    { label: "Utilitas & Sewa", value: totalOverheadSpecific, variant: "primary", show: totalOverheadSpecific > 0 },
                    { label: "Kemasan & Marketing", value: totalMarketingPackaging, variant: "primary", show: totalMarketingPackaging > 0 },
                  ].map((item, i) => item.show !== false && (
                    <div key={i} className="flex justify-between items-center group">
                      <span className={cn(
                        "text-xs sm:text-sm font-bold transition-colors uppercase tracking-tight",
                        item.variant === "danger" ? "text-rose-500" : item.variant === "warning" ? "text-amber-500" : "text-slate-600 group-hover:text-slate-900"
                      )}>
                        {item.label}
                      </span>
                      <span className="text-xs sm:text-sm font-black text-slate-900">
                        Rp {Math.round(item.value).toLocaleString("id-ID")}
                      </span>
                    </div>
                  ))}

                  {costs.map((cost) => (
                    <div key={cost.id} className="flex justify-between items-center group">
                      <span className="text-xs sm:text-sm font-bold text-slate-600 group-hover:text-slate-900 uppercase tracking-tight">
                        {cost.name}
                      </span>
                      <span className="text-xs sm:text-sm font-black text-slate-900">
                        Rp {Math.round(
                          cost.period === "per_produk_turunan"
                            ? Number(cost.price) * totalDerivedQty
                            : Number(cost.price),
                        ).toLocaleString("id-ID")}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Total Row */}
                <div className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t-2 border-indigo-600 flex justify-between items-center bg-indigo-50/30 -mx-6 sm:-mx-10 px-6 sm:px-10 py-5 sm:py-6">
                  <div className="flex flex-col">
                    <span className="text-[8px] sm:text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-1">Grand Total Analysis</span>
                    <span className="text-[10px] sm:text-sm font-black text-slate-900 uppercase tracking-widest">HPP Total Per Batch</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xl sm:text-3xl font-black text-slate-950 tracking-tighter">
                      <span className="text-sm sm:text-lg text-slate-400 mr-1 sm:mr-2 font-bold italic">Rp</span>
                      {Math.round(totalProductionCost).toLocaleString("id-ID")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* HPP PER UNIT SECTION */}
          <div className="px-4 sm:px-10 py-6 sm:py-8 max-w-6xl mx-auto">
            <div className="flex flex-col mb-6 sm:mb-8">
              <h3 className="text-[9px] sm:text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-1">Unit Economics</h3>
              <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">HPP Per Unit Produk</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {hppPerProduct.map((prod) => (
                <div key={prod.id} className="bg-white rounded-lg border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                  <div className="p-5 sm:p-8 space-y-4 sm:space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="size-10 sm:size-12 rounded-lg sm:rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                        <ShoppingBag className="size-5 sm:size-6" />
                      </div>
                      <Badge variant="outline" className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest border-slate-200 text-slate-400 px-2 py-0.5">
                        Batch Output
                      </Badge>
                    </div>

                    <div>
                      <h4 className="text-base sm:text-lg font-black text-slate-950 uppercase tracking-tight line-clamp-1 mb-1">{prod.name}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {prod.qty} {prod.unit} Produced
                        </span>
                        <div className="size-1 rounded-full bg-slate-200" />
                        <span className="text-[9px] sm:text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                          {prod.revenueShare.toFixed(0)}% Weight
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 sm:pt-6 border-t border-slate-50 flex flex-col gap-0.5">
                      <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Cost Per {prod.unit}</span>
                      <div className="text-2xl sm:text-3xl font-black text-indigo-600 tracking-tighter">
                        <span className="text-sm sm:text-base text-indigo-300 mr-1 sm:mr-1.5 font-bold italic">Rp</span>
                        {Math.round(prod.hpp).toLocaleString("id-ID")}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>{" "}
          {/* PRICING STRATEGY SECTION */}
          <div className="px-4 sm:px-10 py-6 sm:py-10 max-w-6xl mx-auto">
            <div className="flex flex-col mb-6 sm:mb-10">
              <h3 className="text-[9px] sm:text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-1">Pricing Strategy</h3>
              <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">Simulasi Harga & Laba</span>
            </div>

            <div className="space-y-8 sm:space-y-12">
              {hppPerProduct.map((prod, idx) => {
                let suggestKompetitif = Math.ceil((prod.hpp * 1.5) / 500) * 500;
                let suggestStandar = Math.ceil((prod.hpp * 2.8) / 1000) * 1000;
                let suggestPremium = Math.ceil((prod.hpp * 3.8) / 1000) * 1000;
                if (suggestStandar <= suggestKompetitif) suggestStandar = suggestKompetitif + 500;
                if (suggestPremium <= suggestStandar) suggestPremium = suggestStandar + 500;

                return (
                  <div key={prod.id} className="bg-white rounded-lg border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                    <div className="bg-slate-50 px-5 sm:px-8 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-7 sm:size-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-[10px] sm:text-xs">
                          {idx + 1}
                        </div>
                        <span className="text-xs sm:text-sm font-black text-slate-950 uppercase tracking-wide truncate max-w-[150px] sm:max-w-none">{prod.name}</span>
                      </div>
                      <Badge className="bg-white text-slate-400 border-slate-200 text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-2 sm:px-3 py-0.5 sm:py-1">
                        HPP: Rp {Math.round(prod.hpp).toLocaleString("id-ID")}
                      </Badge>
                    </div>

                    <div className="p-5 sm:p-10">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
                        {[
                          { label: "Market Leader", price: suggestKompetitif, tag: "Low Margin", desc: "Volume tinggi, penetrasi pasar cepat.", color: "slate" },
                          { label: "Recommended", price: suggestStandar, tag: "Best Value", desc: "Profit seimbang & daya saing optimal.", color: "indigo" },
                          { label: "Premium Tier", price: suggestPremium, tag: "High Value", desc: "Margin maksimal, brand positioning.", color: "emerald" },
                        ].map((tier) => {
                          const isSelected = prod.selected_price === tier.price;
                          return (
                            <button
                              key={tier.label}
                              onClick={() => {
                                setDerivedProducts(derivedProducts.map((p) => p.id === prod.id ? { ...p, selected_price: tier.price } : p));
                                toast.info(`Harga ${tier.label} dipilih`);
                              }}
                              className={cn(
                                "flex flex-col p-5 sm:p-6 rounded-lg border-2 transition-all text-left relative overflow-hidden group",
                                isSelected 
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200 scale-[1.02] z-10" 
                                  : "bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50 text-slate-900"
                              )}
                            >
                              <div className="flex flex-col mb-4 sm:mb-6 relative z-10">
                                <span className={cn(
                                  "text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] mb-1 sm:mb-1.5",
                                  isSelected ? "text-indigo-200" : "text-slate-400"
                                )}>
                                  {tier.label}
                                </span>
                                <h5 className="text-base sm:text-lg font-black uppercase tracking-tight mb-1 sm:mb-2">{tier.tag}</h5>
                                <p className={cn(
                                  "text-[8px] sm:text-[10px] leading-relaxed font-medium opacity-70",
                                  isSelected ? "text-indigo-100" : "text-slate-500"
                                )}>
                                  {tier.desc}
                                </p>
                              </div>

                              <div className="mt-auto relative z-10">
                                <div className="text-xl sm:text-2xl font-black tracking-tighter mb-3 sm:mb-4">
                                  <span className={cn("text-xs sm:text-sm mr-1", isSelected ? "text-white/40" : "text-slate-300")}>Rp</span>
                                  {tier.price.toLocaleString("id-ID")}
                                </div>
                                <div className={cn(
                                  "flex flex-col gap-1 sm:gap-1.5 pt-3 sm:pt-4 border-t",
                                  isSelected ? "border-white/10 text-indigo-100" : "border-slate-100 text-slate-500"
                                )}>
                                  <div className="flex justify-between text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">
                                    <span>Margin:</span>
                                    <span className={isSelected ? "text-white" : "text-emerald-600"}>
                                      {(((tier.price - prod.hpp) / tier.price) * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">
                                    <span>Profit/Unit:</span>
                                    <span className={isSelected ? "text-white" : "text-slate-950 font-black"}>
                                      Rp {(tier.price - prod.hpp).toLocaleString("id-ID")}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="bg-slate-50 rounded-lg p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 items-center">
                        <div className="space-y-3 sm:space-y-4">
                          <Label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Kustom Harga Jual</Label>
                          <div className="relative group">
                            <Input
                              value={formatCurrency(prod.selected_price || "")}
                              onChange={(e) => setDerivedProducts(derivedProducts.map((p) => p.id === prod.id ? { ...p, selected_price: parseCurrency(e.target.value) } : p))}
                              className="h-12 sm:h-16 border-0 border-b-2 rounded-none focus:ring-0 focus:border-indigo-600 focus-visible:ring-0 focus-visible:border-indigo-600 font-black text-2xl sm:text-4xl bg-transparent pl-10 sm:pl-12 transition-all border-slate-200"
                            />
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 text-base sm:text-xl font-black text-slate-300">Rp</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-start md:items-end">
                          <Label className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2 sm:mb-4">Proyeksi Laba Bersih / Unit</Label>
                          <div className="text-3xl sm:text-5xl font-black text-emerald-600 tracking-tighter">
                            <span className="text-lg sm:text-xl text-emerald-200 mr-1 sm:mr-2 font-bold italic">Rp</span>
                            {Math.round((Number(prod.selected_price) || 0) - (Number(prod.hpp) || 0)).toLocaleString("id-ID")}
                          </div>
                          <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 sm:mt-2">Berdasarkan Harga Kustom</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FINAL ACTION SECTION */}
          <div className="px-6 py-12 sm:px-10 sm:py-16 bg-white border-t border-slate-100 flex flex-col items-center">
            <div className="max-w-md w-full space-y-6 text-center">
              <div className="space-y-2 mb-8">
                <h4 className="text-xl font-black text-slate-950 uppercase tracking-tight">Siap Untuk Simpan?</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  Data analisis ini akan disimpan ke dalam riwayat kalkulasi Anda dan dapat diakses kapan saja.
                </p>
              </div>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full h-16 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest transition-all active:scale-95 shadow-2xl shadow-indigo-200 gap-4 text-base group overflow-hidden relative"
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <Save className={cn("h-5 w-5 relative z-10 transition-transform group-hover:scale-110", isSaving && "animate-spin")} />
                <span className="relative z-10">{isSaving ? "MENYIMPAN DATA..." : "SIMPAN ANALISIS SEKARANG"}</span>
              </Button>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-6">
                KasirHub Premium <span className="mx-2">•</span> Financial Analyst AI
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  </main>
</SettingsLayout>
  );
}

