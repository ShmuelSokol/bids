-- dbo.material_reserve_1_view



/* view material_reserve_1_view: add view */


/* view material_reserve_1_view: add view */


/* view material_reserve_1_view: add view */

/* view material_reserve_1_view: add view */


/* view material_reserve_1_view: add view */


/* view material_reserve_1_view: add view */


/* view material_reserve_1_view: add view */


/* view material_reserve_1_view: add view */


/* view material_reserve_1_view: add view */


/* view material_reserve_1_view: add view */
/* view material_reserve_1_view: add view 
 view material_reserve_1_view: add view 
 view material_reserve_1_view: add view 
 view material_reserve_1_view: add view 
 view material_reserve_1_view: add view 
 view material_reserve_1_view: add view 
 view material_reserve_1_view: add view 
 view material_reserve_1_view: add view */
CREATE VIEW [dbo].[material_reserve_1_view]
AS
SELECT        dbo.kak_tab.rsttbl_kak, dbo.kak_tab.rsvqty_kak, dbo.kak_tab.idnkak_kak, dbo.clin_demand_control_1_view.cntrct_k79, dbo.clin_demand_control_1_view.rel_no_k80, dbo.clin_demand_control_1_view.clinno_k81, 
                         dbo.clin_demand_control_1_view.prtnum_k71, dbo.clin_demand_control_1_view.pn_rev_k71, dbo.clin_demand_control_1_view.p_desc_k71, dbo.clin_demand_control_1_view.fsc_k08, 
                         dbo.clin_demand_control_1_view.niin_k08, dbo.clin_demand_control_1_view.idnk71_k71, dbo.clin_demand_control_1_view.idnk79_k79, dbo.clin_demand_control_1_view.idnk80_k80, 
                         dbo.clin_demand_control_1_view.idnk81_k81, dbo.clin_demand_control_1_view.idnk85_k85, dbo.supplier_po_part_1_view.s_code_k39 AS s_code_bko, 
                         dbo.supplier_po_part_1_view.e_name_k12 AS e_name_bko, dbo.supplier_po_part_1_view.por_no_k89 AS por_no_bko, dbo.supplier_po_part_1_view.idnk90_k90 AS idnk90_bko, 
                         dbo.inventory_part_2_view.e_code_imp, dbo.inventory_part_2_view.e_name_imp, dbo.inventory_part_2_view.e_code_vnd, dbo.inventory_part_2_view.e_name_vnd, dbo.inventory_part_2_view.idnk93_k93, 
                         dbo.supplier_po_part_1_view.idnk89_k89, dbo.clin_demand_control_1_view.piidno_k80
FROM            dbo.kak_tab INNER JOIN
                         dbo.clin_demand_control_1_view ON dbo.kak_tab.idnk85_kak = dbo.clin_demand_control_1_view.idnk85_k85 LEFT OUTER JOIN
                         dbo.supplier_po_part_1_view ON dbo.kak_tab.idnrst_kak = dbo.supplier_po_part_1_view.idnk90_k90 AND dbo.kak_tab.rsttbl_kak = 'k90' LEFT OUTER JOIN
                         dbo.inventory_part_2_view ON dbo.kak_tab.idnrst_kak = dbo.inventory_part_2_view.idnk93_k93 AND dbo.kak_tab.rsttbl_kak = 'k93'










