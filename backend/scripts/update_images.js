const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/merchant_db.json');
const raw = fs.readFileSync(dbPath, 'utf8');
const data = JSON.parse(raw);

// Complete map of unique, distinct Unsplash photos for all 35 products
const productImages = {
  // Grains & Pulses
  "Basmati Rice (5 Kg)": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80",
  "Toor Dal (1 Kg)": "https://images.unsplash.com/photo-1585996792655-d7b5d1c68b77?w=400&auto=format&fit=crop&q=80",
  "Wheat Flour (10 Kg)": "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&auto=format&fit=crop&q=80",
  "Chana Dal (500g)": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80",
  "Moong Dal (1 Kg)": "https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=400&auto=format&fit=crop&q=80",
  
  // Dairy & Eggs
  "Amul Full Cream Milk (1L)": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&auto=format&fit=crop&q=80",
  "Amul Butter (500g)": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&auto=format&fit=crop&q=80",
  "Farm Fresh Eggs (12 pcs)": "https://images.unsplash.com/photo-1587486913049-53fc88980cfc?w=400&auto=format&fit=crop&q=80",
  "Mother Dairy Curd (500g)": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&auto=format&fit=crop&q=80",
  "Amul Paneer (200g)": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=400&auto=format&fit=crop&q=80",

  // Beverages & Juices
  "Pepsi 600ml": "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=400&auto=format&fit=crop&q=80",
  "Real Mango Juice (1L)": "https://images.unsplash.com/photo-1546173159-315724a31696?w=400&auto=format&fit=crop&q=80",
  "Tata Tea Premium (250g)": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80",
  "Nescafe Classic (100g)": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=80",
  "Bisleri Water (1L)": "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&auto=format&fit=crop&q=80",

  // Snacks & Biscuits
  "Lays Classic Salted (52g)": "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&auto=format&fit=crop&q=80",
  "Parle-G Biscuits (800g)": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&auto=format&fit=crop&q=80",
  "Kurkure Masala Munch (90g)": "https://images.unsplash.com/photo-1621996346565-e3d5d628169a?w=400&auto=format&fit=crop&q=80",
  "Oreo Cookies (120g)": "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=400&auto=format&fit=crop&q=80",
  "Haldirams Mixture (200g)": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&auto=format&fit=crop&q=80",

  // Spices, Oils & Condiments
  "Catch Cumin Seeds (100g)": "https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=400&auto=format&fit=crop&q=80",
  "Sundrop Sunflower Oil (1L)": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80",
  "MDH Garam Masala (100g)": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&auto=format&fit=crop&q=80",
  "Tata Salt (1 Kg)": "https://images.unsplash.com/photo-1518110903410-b969e6b7ca2c?w=400&auto=format&fit=crop&q=80",
  "Kissan Tomato Ketchup (500g)": "https://images.unsplash.com/photo-1607532941433-304659e8198a?w=400&auto=format&fit=crop&q=80",

  // Household & Personal Care
  "Surf Excel (1 Kg)": "https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400&auto=format&fit=crop&q=80",
  "Vim Dishwash Gel (500ml)": "https://images.unsplash.com/photo-1585837575652-267c041d77d4?w=400&auto=format&fit=crop&q=80",
  "Lizol Floor Cleaner (500ml)": "https://images.unsplash.com/photo-1584813470613-5b1c1cad3d69?w=400&auto=format&fit=crop&q=80",
  "Colgate Toothpaste (150g)": "https://images.unsplash.com/photo-1559599101-f09722fb4948?w=400&auto=format&fit=crop&q=80",
  "Dove Soap (100g)": "https://images.unsplash.com/photo-1607006314777-628e83f2dc5a?w=400&auto=format&fit=crop&q=80",

  // Fresh Fruits & Veggies
  "Fresh Tomatoes (1 Kg)": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&auto=format&fit=crop&q=80",
  "Bananas (1 Dozen)": "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400&auto=format&fit=crop&q=80",
  "Onions (1 Kg)": "https://images.unsplash.com/photo-1508747703725-719777637510?w=400&auto=format&fit=crop&q=80",
  "Potatoes (1 Kg)": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&auto=format&fit=crop&q=80",
  "Green Apples (4 pcs)": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&auto=format&fit=crop&q=80"
};

// Curated distinctive supplier logos
const supplierLogos = {
  "sup_001": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&auto=format&fit=crop&q=80", // Agro Grain Depot
  "sup_002": "https://images.unsplash.com/photo-1527153857715-3908f2bae5e8?w=400&auto=format&fit=crop&q=80", // Dairy Farms & Creamery
  "sup_003": "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&auto=format&fit=crop&q=80", // Beverage & Cold Store
  "sup_004": "https://images.unsplash.com/photo-1553413077-190dd305871c?w=400&auto=format&fit=crop&q=80"  // Packaged FMCG Distribution
};

let prodUpdated = 0;
data.products.forEach(p => {
  if (productImages[p.name]) {
    p.image_url = productImages[p.name];
    prodUpdated++;
  }
});

let supUpdated = 0;
data.suppliers.forEach(s => {
  if (supplierLogos[s.id]) {
    s.logo_url = supplierLogos[s.id];
    supUpdated++;
  }
});

fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`ALL DONE: Successfully assigned unique images to ${prodUpdated}/${data.products.length} products and ${supUpdated}/${data.suppliers.length} suppliers!`);
