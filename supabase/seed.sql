-- ============================================================
-- DATOS INICIALES — migrados desde Google Sheets ya validado
-- ============================================================

-- PRODUCTS
insert into products (sku, product_group, ean, product_name, category, size, base_price_gbp, base_price_eur, image_url, active) values
('CHGB001X3','CHAMOISGRIPGREENPACKX3','7798326978204','Chamois Grip Green Pack x3','Accessories','One Size',1.00,1.50,'https://cdn.shopify.com/s/files/1/0287/8174/0118/files/Ball-GripsNuevos-ChamoisX3_Green-1200x1800_57801364-1474-431b-b6f0-b653589d3f1b.jpg?v=1772038652',true),
('PCPVCBJR','PCPVCBLACK','7798326977764','PC PVC Black','Accessories','Junior',2.00,2.50,'https://cdn.shopify.com/s/files/1/0287/8174/0118/files/Ball-Mask_PVC-45-1200x1800.jpg?v=1774770537',true),
('PCPVCBSR','PCPVCBLACK','7798326977658','PC PVC Black','Accessories','Senior',2.00,2.50,'https://cdn.shopify.com/s/files/1/0287/8174/0118/files/Ball-Mask_PVC-45-1200x1800.jpg?v=1774770537',true),
('LST250','ALTER2LARGESTICKBAGTAUPE','7798326977771','Alter/2 Large Stickbag Taupe','Bags','One Size',3.00,4.00,'https://cdn.shopify.com/s/files/1/0287/8174/0118/files/ball-alter-2-large-stickbag-taupe-1.jpg?v=1777560372',true),
('SBB97ULH365','BLOOM97ULTRALOWHOLLYHOCK','7798326979669','Bloom 97 Ultralow Hollyhock','Sticks','36.5"',10.00,15.00,'https://cdn.shopify.com/s/files/1/0287/8174/0118/files/Ball-Bloom-Power_97-Ultralow_Hollyhock-1200x1800-Slide_01.jpg?v=1777793259',true),
('SBB97LBS375','BLOOM97ULTRALOWHOLLYHOCK','7798326979638','Bloom 97 Ultralow Hollyhock','Sticks','37.5"',10.00,15.00,'https://cdn.shopify.com/s/files/1/0287/8174/0118/files/Ball-Bloom-Power_97-Ultralow_Hollyhock-1200x1800-Slide_01.jpg?v=1777793259',true);

-- STOCK UK
insert into stock_uk (sku, stock) values
('CHGB001X3',1),
('PCPVCBJR',2),
('PCPVCBSR',3),
('LST250',4),
('SBB97ULH365',5),
('SBB97LBS375',6);

-- STOCK EU
insert into stock_eu (sku, stock) values
('CHGB001X3',3),
('PCPVCBJR',4),
('PCPVCBSR',5),
('LST250',6),
('SBB97ULH365',7),
('SBB97LBS375',8);

-- CUSTOMERS
insert into customers (customer_id, customer_name, contact_name, email_login, country, region, warehouse, currency, vat_rule, shipping_rule, active) values
('C001','Jumbo Hockey','Patrick','orders@jumbo.nl','Netherlands','EU','EU','EUR','EU_EXEMPT','EU_STANDARD',true),
('C002','Cricket Hockey','Jaime','jaime@ch.com','United Kingdom','UK','UK','GBP','UK_STANDARD','UK_STANDARD',true),
('C003','Full Hockey','Martin','martin@fullhockey.com','Spain','EU','EU','EUR','ES_STANDARD','FREE_SHIPPING',true);

-- CUSTOMER DISCOUNTS
insert into customer_discounts (customer_id, sticks_pct, bags_pct, accessories_pct, apparel_pct, shoes_pct) values
('C001',20.0,15.0,10.0,15.0,10.0),
('C002',15.0,10.0,0.0,10.0,10.0),
('C003',25.0,20.0,15.0,20.0,0.0);

-- VAT RULES
insert into vat_rules (vat_rule, vat_pct) values
('UK_STANDARD',20.0),
('EU_EXEMPT',0.0),
('ES_STANDARD',21.0);

-- PROMOTIONS
insert into promotions (promo_id, promo_name, category, extra_discount_pct, start_date, end_date, active) values
('P001','Summer Bags','Bags',10.0,'2026-07-01','2026-07-31',true);
