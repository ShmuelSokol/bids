-- dbo.carrier_account_1_view



/* view carrier_account_1_view: add view */


/* view carrier_account_1_view: add view */


/* view carrier_account_1_view: add view */

/* view carrier_account_1_view: add view */


/* view carrier_account_1_view: add view */


/* view carrier_account_1_view: add view */


/* view carrier_account_1_view: add view */


/* view carrier_account_1_view: add view */


/* view carrier_account_1_view: add view */


/* view carrier_account_1_view: add view */


/* view carrier_account_1_view: add view */


/* view carrier_account_1_view: add view */


/* view carrier_account_1_view: add view */


/* view carrier_account_1_view: add view */


/* view carrier_account_1_view: add view */


/* view carrier_account_1_view: add view */


/* view carrier_account_1_view: add view */


/* view carrier_account_1_view: add view */
CREATE VIEW [dbo].[carrier_account_1_view]
AS
SELECT     carrier_tab.e_code_k12 AS e_code_car, carrier_tab.e_name_k12 AS e_name_car, owner_tab.e_code_k12 AS e_code_cac, owner_tab.e_name_k12 AS e_name_cac, 
                      dbo.kcw_tab.cactyp_kcw, ship_via.catitl_kap AS catitl_via, ship_via.catdes_kap AS catdes_via, shipment_type.catype_kap AS catype_typ, 
                      shipment_type.catitl_kap AS catitl_typ, shipment_type.catdes_kap AS catdes_typ, dbo.kcw_tab.cactno_kcw, dbo.kcw_tab.idnkcw_kcw, 
                      carrier_tab.idnk12_k12 AS idnk12_car, owner_tab.idnk12_k12 AS idnk12_cac, ship_via.idnkap_kap AS idnkap_via, shipment_type.idnkap_kap AS idnkap_typ, 
                      dbo.kcw_tab.viakap_kcw, dbo.kcw_tab.typkap_kcw, dbo.kcw_tab.cark12_kcw
FROM         dbo.kcw_tab INNER JOIN
                      dbo.general_category_1_view AS ship_via ON dbo.kcw_tab.viakap_kcw = ship_via.idnkap_kap INNER JOIN
                      dbo.general_category_1_view AS shipment_type ON dbo.kcw_tab.typkap_kcw = shipment_type.idnkap_kap INNER JOIN
                      dbo.k12_tab AS carrier_tab ON dbo.kcw_tab.cark12_kcw = carrier_tab.idnk12_k12 INNER JOIN
                      dbo.k12_tab AS owner_tab ON dbo.kcw_tab.cack12_kcw = owner_tab.idnk12_k12
WHERE     (shipment_type.catset_kbd = 'Transportation Service') AND (ship_via.catset_kbd = 'Ship Via')


















