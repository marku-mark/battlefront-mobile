import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
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
import { Chatbot } from "@/components/support/Chatbot";
import { ProductDetails } from "@/components/products/ProductDetails";
import { ProductSearch } from "@/components/search/ProductSearch";
import { useCart } from "@/hooks/useCart";

export default function HomeScreen() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [flashDeals, setFlashDeals] = useState<Product[]>([]);
  const [sulitPicks, setSulitPicks] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const { addItem, itemCount } = useCart();

  const flashDealEndTime = useMemo(() => getFlashDealEndTime(), []);
  const searchableProducts = useMemo(
    () => [...flashDeals, ...sulitPicks, ...newArrivals],
    [flashDeals, newArrivals, sulitPicks]
  );

  function handleProductSelect(product: Product) {
    setIsSearchOpen(false);
    setSelectedProduct(product);
    setQuantity(1);
  }

  function handleProductClose() {
    setSelectedProduct(null);
  }

  function handleAddToCart(product: Product, itemQuantity: number) {
    addItem(product, itemQuantity);
    Alert.alert(
      "Added to cart",
      `${itemQuantity} x ${product.name} added to your cart.`,
      [{ text: "Continue shopping", onPress: handleProductClose }]
    );
  }

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
      <Header cartCount={itemCount} onSearchPress={() => setIsSearchOpen(true)} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <PromoBanners banners={banners} />
        <Categories categories={categories} />
        <FlashDeals
          products={flashDeals}
          endTime={flashDealEndTime}
          onSelectProduct={handleProductSelect}
        />
        <TrustBar />
        <SulitPicks products={sulitPicks} onSelectProduct={handleProductSelect} />
        <NewArrivals products={newArrivals} onSelectProduct={handleProductSelect} />
        <Brands brands={brands} />
        <View className="h-6" />
      </ScrollView>
      <Pressable
        accessibilityLabel="Open Battlefront Support chat"
        onPress={() => setIsChatOpen(true)}
        className="absolute right-4 bottom-5 w-14 h-14 rounded-full bg-primary items-center justify-center"
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#f8fafc" />
      </Pressable>
      <Chatbot visible={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <ProductSearch
        visible={isSearchOpen}
        products={searchableProducts}
        onClose={() => setIsSearchOpen(false)}
        onSelectProduct={handleProductSelect}
      />
      <Modal
        visible={selectedProduct !== null}
        animationType="slide"
        onRequestClose={handleProductClose}
      >
        {selectedProduct && (
          <ProductDetails
            product={selectedProduct}
            quantity={quantity}
            onQuantityChange={setQuantity}
            onAddToCart={handleAddToCart}
            onClose={handleProductClose}
          />
        )}
      </Modal>
    </View>
  );
}
