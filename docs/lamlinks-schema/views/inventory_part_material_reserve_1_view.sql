-- dbo.inventory_part_material_reserve_1_view



/* view inventory_part_material_reserve_1_view: add view */


/* view inventory_part_material_reserve_1_view: add view */


/* view inventory_part_material_reserve_1_view: add view */

/* view inventory_part_material_reserve_1_view: add view */


/* view inventory_part_material_reserve_1_view: add view */


/* view inventory_part_material_reserve_1_view: add view */


/* view inventory_part_material_reserve_1_view: add view */


/* view inventory_part_material_reserve_1_view: add view */


/* view inventory_part_material_reserve_1_view: add view */


/* view inventory_part_material_reserve_1_view: add view */
/* view inventory_part_material_reserve_1_view: add view 
 view inventory_part_material_reserve_1_view: add view 
 view inventory_part_material_reserve_1_view: add view 
 view inventory_part_material_reserve_1_view: add view 
 view inventory_part_material_reserve_1_view: add view 
 view inventory_part_material_reserve_1_view: add view 
 view inventory_part_material_reserve_1_view: add view 
 view inventory_part_material_reserve_1_view: add view */
CREATE VIEW [dbo].[inventory_part_material_reserve_1_view]
AS
SELECT        dbo.material_reserve_1_view.cntrct_k79, dbo.material_reserve_1_view.rel_no_k80, dbo.material_reserve_1_view.clinno_k81, dbo.inventory_part_2_view.fsc_k08, dbo.inventory_part_2_view.niin_k08, 
                         dbo.inventory_part_2_view.e_code_mfg, dbo.inventory_part_2_view.prtnum_k71, dbo.inventory_part_2_view.pn_rev_k71, dbo.inventory_part_2_view.p_desc_k71, dbo.inventory_part_2_view.snq_11_k90, 
                         dbo.inventory_part_2_view.snq_21_k93, dbo.inventory_part_2_view.slq_21_k93, dbo.inventory_part_2_view.soq_21_k93, dbo.inventory_part_2_view.instat_k93, dbo.inventory_part_2_view.ictref_kbb, 
                         dbo.inventory_part_2_view.e_code_imp, dbo.inventory_part_2_view.e_name_imp, dbo.inventory_part_2_view.e_code_vnd, dbo.inventory_part_2_view.e_name_vnd, dbo.inventory_part_2_view.por_no_k89, 
                         dbo.inventory_part_2_view.cnt_no_k89, dbo.inventory_part_2_view.rcvdte_k98, dbo.inventory_part_2_view.nni_no_k95, dbo.inventory_part_2_view.effdte_k95, dbo.inventory_part_2_view.idnk93_k93, 
                         dbo.inventory_part_2_view.addtme_kbb, dbo.inventory_part_2_view.idnk92_k92, dbo.inventory_part_2_view.idnk99_k99, dbo.inventory_part_2_view.idnk98_k98, dbo.inventory_part_2_view.gduset_imp, 
                         dbo.inventory_part_2_view.locatn_kbc, dbo.inventory_part_2_view.d_code_whs, dbo.inventory_part_2_view.d_name_whs, dbo.inventory_part_2_view.idnk08_k08, dbo.inventory_part_2_view.invsta_k93, 
                         dbo.inventory_part_2_view.idnk89_k89, dbo.inventory_part_2_view.plr_no_k98, dbo.inventory_part_2_view.idnk71_k71, dbo.inventory_part_2_view.idnk95_k95, dbo.inventory_part_2_view.idnk90_k90, 
                         dbo.inventory_part_2_view.p_um_k71, dbo.inventory_part_2_view.locqty_kbc, dbo.inventory_part_2_view.idnkbb_kbb, dbo.inventory_part_2_view.idnk12_vnd, dbo.inventory_part_2_view.idnk12_imp, 
                         dbo.material_reserve_1_view.piidno_k80
FROM            dbo.material_reserve_1_view INNER JOIN
                         dbo.inventory_part_2_view ON dbo.material_reserve_1_view.idnk93_k93 = dbo.inventory_part_2_view.idnk93_k93










