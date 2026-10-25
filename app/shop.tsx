import React, { useEffect, useRef, useState } from "react";
import { analytics } from "../src/lib/analytics";
import { Linking, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Body,
  Button,
  EmptyState,
  ErrorState,
  FlatHeader,
  Heading,
  LoadingSkeleton,
  Page,
  SegmentedControl,
} from "../src/components/ui";
import { ProductRow } from "../src/components/ProductRow";
import { FloatingTabBar } from "../src/components/FloatingTabBar";
import {
  catalog,
  ecosusiTestCatalog,
  retailerDestination,
  shoppingSource,
  type Product,
} from "../src/lib/shopping";
import {
  budgetMinor,
  comparisonGroups,
  money,
} from "../src/lib/shopping-domain";
import { categories } from "../src/lib/library";
import { useApp } from "../src/lib/state";
import { colors, fonts } from "../src/theme";
export default function Shop() {
  const params = useLocalSearchParams<{
      look?: string;
      library?: string;
      job?: string;
    }>(),
    { session } = useApp();
  const [segment, setSegment] = useState("Similar"),
    [live, setLive] = useState(false),
    [testPreview, setTestPreview] = useState(false),
    [category, setCategory] = useState("Jackets"),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [maximum, setMaximum] = useState("50"),
    [compare, setCompare] = useState(false),
    [expanded, setExpanded] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [refine, setRefine] = useState(false);
  const sourceKey = [params.look, params.library, params.job].join("|"),
    initialized = useRef("");
  const source = useQuery({
    queryKey: ["shopping-source", session?.user.id, sourceKey],
    queryFn: () => shoppingSource(params),
    retry: 1,
  });
  useEffect(() => {
    if (source.data && initialized.current !== sourceKey) {
      initialized.current = sourceKey;
      const hint = source.data.hints[0];
      if (hint) {
        setCategory(hint.category);
        setSearch([hint.brand, hint.color].filter(Boolean).join(" "));
      }
    }
  }, [source.data, sourceKey]);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  let maxMinor: number | null = null,
    budgetError = "";
  if (segment === "Budget") {
    try {
      maxMinor = budgetMinor(maximum);
      if (maxMinor === null || maxMinor <= 0)
        budgetError = "Enter a maximum price greater than zero.";
    } catch (e) {
      budgetError =
        e instanceof Error ? e.message : "Enter a valid maximum price.";
    }
  }
  const products = useInfiniteQuery({
    queryKey: [
      "catalog",
      session?.user.id,
      live,
      testPreview,
      category,
      query,
      segment,
      maxMinor,
      source.data?.exploreId,
    ],
    queryFn: ({ pageParam }) =>
      (testPreview ? ecosusiTestCatalog : catalog).page(
        {
          category,
          live: live && !testPreview,
          search: query,
          currency: "USD",
          maxMinor: segment === "Budget" ? maxMinor : null,
          exactExplore:
            segment === "Exact"
              ? (source.data?.exploreId ?? "no-verified-source")
              : null,
        },
        pageParam,
      ),
    initialPageParam: undefined as { price: number; id: string } | undefined,
    getNextPageParam: (page) =>
      page.length === 20
        ? { price: page[19]!.price_minor, id: page[19]!.id }
        : undefined,
    enabled: !!source.data && !budgetError,
    staleTime: 30000,
    refetchInterval: live ? 30000 : false,
  });
  const items = products.data?.pages.flat() ?? [];
  async function openRetailer(item: Product) {
    if (busy || item.is_demo) return;
    setBusy(true);
    setError("");
    try {
      if (item.is_test_preview) {
        if (!item.product_url)
          throw new Error("The direct product link is missing.");
        await Linking.openURL(item.product_url);
        analytics.track("product_clicked", { link: "retailer" });
        return;
      }
      const target = await retailerDestination(item.id);
      await Linking.openURL(target.url);
      analytics.track("product_clicked", {
        link: target.affiliate ? "affiliate" : "retailer",
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The retailer link couldn’t open.",
      );
    } finally {
      setBusy(false);
    }
  }
  const field = {
    backgroundColor: colors.white,
    padding: 14,
    borderRadius: 18,
    fontFamily: fonts.body,
    fontSize: 16,
  };
  return (
    <View style={{ flex: 1 }}>
      <Page>
        <FlatHeader title="Shop the look" pill="Catalog">
          <SegmentedControl
            options={["Exact", "Similar", "Budget"]}
            selected={segment}
            onChange={(value) => {
              setSegment(value);
              setCompare(false);
              setExpanded(null);
            }}
          />
        </FlatHeader>
        <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 14 }}>
          <View
            style={{
              padding: 16,
              borderRadius: 22,
              backgroundColor: colors.chip,
              gap: 6,
            }}
          >
            <Heading size={19}>
              {testPreview
                ? "Ecosusi test preview · USD"
                : live
                  ? "USA retailer catalog · USD"
                  : "Sample catalog · USD"}
            </Heading>
            <Body style={{ fontSize: 13 }}>
              {testPreview
                ? "Test-only snapshot from May 15, 2026. Prices may have changed and availability is unverified. Product pages open directly; no commission tracking is used."
                : live
                  ? "Approved US retailer offers only. Expired and out-of-stock offers are hidden. Prices exclude shipping and tax; confirm details with the retailer."
                  : "Original garment illustrations and illustrative prices demonstrate the shopping flow. These samples cannot be purchased."}
            </Body>
            <Button
              secondary
              title={
                testPreview
                  ? "Exit Ecosusi test preview"
                  : "Try Ecosusi test preview · 68 products"
              }
              onPress={() => {
                const enabled = !testPreview;
                setTestPreview(enabled);
                if (enabled) {
                  setLive(false);
                  setCategory("Accessories");
                  setSegment("Similar");
                  setSearch("");
                }
                setCompare(false);
                setExpanded(null);
              }}
            />
            <Button
              secondary
              title={live ? "View sample catalog" : "View USA retailer catalog"}
              onPress={() => {
                setTestPreview(false);
                setLive(!live);
                setCompare(false);
                setExpanded(null);
              }}
            />
          </View>
          {source.isError ? (
            <ErrorState
              message="This saved look couldn’t load. It may no longer be available."
              retry={() => void source.refetch()}
            />
          ) : source.isPending ? (
            <LoadingSkeleton />
          ) : (
            <>
              <Heading size={22}>{source.data.name}</Heading>
              <Body style={{ fontSize: 13 }}>
                {source.data.hints.length
                  ? "Category and search use your saved details, not automatic image recognition."
                  : "Choose a garment category and search words below. No image is sent to an identification service."}
              </Body>
              <Button
                secondary
                title={
                  refine ? "Hide search filters" : `Refine search · ${category}`
                }
                onPress={() => setRefine(!refine)}
              />
              {refine && (
                <>
                  <Button
                    secondary
                    title="Choose another saved look"
                    onPress={() => router.push("/shop-saved")}
                  />
                  <Body>Garment category</Body>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {categories.map((value) => (
                      <Button
                        key={value}
                        secondary={category !== value}
                        title={value}
                        style={{ minHeight: 38, paddingHorizontal: 12 }}
                        onPress={() => {
                          setCategory(value);
                          setCompare(false);
                        }}
                      />
                    ))}
                  </View>
                </>
              )}
              <TextInput
                accessibilityLabel="Search catalog names, colors, brands and tags"
                value={search}
                onChangeText={setSearch}
                maxLength={100}
                placeholder="Search name, color, brand or tag"
                style={field}
              />
              {segment === "Budget" && (
                <>
                  <Body>Under this amount · USD</Body>
                  <TextInput
                    accessibilityLabel="Maximum budget in USD"
                    value={maximum}
                    onChangeText={setMaximum}
                    keyboardType="decimal-pad"
                    maxLength={9}
                    style={field}
                  />
                </>
              )}
              {!!budgetError ? (
                <EmptyState title="Set your budget." message={budgetError} />
              ) : products.isPending ? (
                <LoadingSkeleton />
              ) : products.isError && !items.length ? (
                <ErrorState
                  message="Product results couldn’t load."
                  retry={() => void products.refetch()}
                />
              ) : (
                <>
                  {!items.length && (
                    <EmptyState
                      title={
                        segment === "Exact"
                          ? "No verified exact matches."
                          : "No matching catalog products."
                      }
                      message={
                        segment === "Exact"
                          ? "Exact matches require a verified catalog identifier, retailer SKU or manual review with evidence. Similar-looking images and demo products never count as exact matches."
                          : testPreview
                            ? "No Ecosusi products match. Try another search or select Accessories."
                            : live
                              ? "No current approved US offers match. The first retailer feed is awaiting access; expired offers are hidden. Try the sample catalog to test the flow."
                              : "Try another category, search term or maximum price. The sample catalog currently contains tops and jackets."
                      }
                      action={
                        segment === "Exact" ? "See similar styles" : undefined
                      }
                      onPress={() => setSegment("Similar")}
                    />
                  )}
                  {items.map((item) => (
                    <ProductRow
                      key={item.id}
                      item={item}
                      expanded={expanded === item.id}
                      onPress={() =>
                        setExpanded(expanded === item.id ? null : item.id)
                      }
                      onRetailer={() => void openRetailer(item)}
                      busy={busy}
                    />
                  ))}
                  {products.isFetchNextPageError && (
                    <ErrorState
                      message="More products couldn’t load."
                      retry={() => void products.fetchNextPage()}
                    />
                  )}
                  {products.hasNextPage && (
                    <Button
                      secondary
                      disabled={products.isFetchingNextPage}
                      title={
                        products.isFetchingNextPage
                          ? "Loading…"
                          : "Load more products"
                      }
                      onPress={() => void products.fetchNextPage()}
                    />
                  )}
                  {!!items.length && (
                    <Button
                      icon="shopping-bag"
                      title={compare ? "Hide comparison" : "Compare prices"}
                      onPress={() => setCompare(!compare)}
                    />
                  )}
                  {compare && (
                    <View
                      style={{
                        padding: 18,
                        borderRadius: 24,
                        backgroundColor: colors.white,
                        gap: 14,
                      }}
                    >
                      <Heading size={23}>Compare displayed prices</Heading>
                      {comparisonGroups(items).map((group) => (
                        <View key={group.key} style={{ gap: 10 }}>
                          <Heading size={17}>{group.key}</Heading>
                          {group.items.map((item, index) => (
                            <View
                              key={item.id}
                              style={{ flexDirection: "row", gap: 10 }}
                            >
                              <Body style={{ flex: 1, fontSize: 14 }}>
                                {item.name}
                                {index === 0 ? " · lowest shown" : ""}
                              </Body>
                              <Heading size={16}>
                                {money(item.price_minor, item.currency)}
                              </Heading>
                            </View>
                          ))}
                        </View>
                      ))}
                      <Body style={{ fontSize: 12 }}>
                        Compares loaded products of the same category, currency
                        and catalog mode. Test preview prices come from the May
                        15, 2026 feed snapshot and may have changed.
                      </Body>
                    </View>
                  )}
                </>
              )}
            </>
          )}
          {!!error && <Body>{error}</Body>}
        </View>
      </Page>
      <FloatingTabBar active="Closet" />
    </View>
  );
}
