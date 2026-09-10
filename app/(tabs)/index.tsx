import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import {
  getBanners,
  getBrands,
  getCategories,
  getFlashDealEndTime,
  getFlashDeals,
  getNewArrivals,
  getSulitPicks,
} from "@/lib/api";
import type { Banner, Brand, Category, Product } from "@/lib/data";
import { Header } from "@/components/layout/Header";
import { PromoBanners } from "@/components/sections/PromoBanners";
import { Categories } from "@/components/sections/Categories";
import { FlashDeals } from "@/components/sections/FlashDeals";
import { TrustBar } from "@/components/sections/TrustBar";
import { SulitPicks } from "@/components/sections/SulitPicks";
import { NewArrivals } from "@/components/sections/NewArrivals";
import { Brands } from "@/components/sections/Brands";

export default function HomeScreen() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [flashDeals, setFlashDeals] = useState<Product[]>([]);
  const [sulitPicks, setSulitPicks] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const flashDealEndTime = useMemo(() => getFlashDealEndTime(), []);

  useEffect(() => {
    getBanners().then(setBanners);
    getCategories().then(setCategories);
    getFlashDeals().then(setFlashDeals);
    getSulitPicks().then(setSulitPicks);
    getNewArrivals().then(setNewArrivals);
    getBrands().then(setBrands);
  }, []);

  return (
    <View className="flex-1 bg-background">
      <Header cartCount={0} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <PromoBanners banners={banners} />
        <Categories categories={categories} />
        <FlashDeals products={flashDeals} endTime={flashDealEndTime} />
        <TrustBar />
        <SulitPicks products={sulitPicks} />
        <NewArrivals products={newArrivals} />
        <Brands brands={brands} />
        <View className="h-6" />
      </ScrollView>
    </View>
  );
}
