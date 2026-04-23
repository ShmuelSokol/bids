-- dbo.inventory_part_2_view



/* view inventory_part_2_view: add view */


/* view inventory_part_2_view: add view */


/* view inventory_part_2_view: add view */

/* view inventory_part_2_view: add view */


/* view inventory_part_2_view: add view */


/* view inventory_part_2_view: add view */


/* view inventory_part_2_view: add view */


/* view inventory_part_2_view: add view */
CREATE VIEW [dbo].[inventory_part_2_view]
AS
SELECT        dbo.inventory_part_1_view.fsc_k08, dbo.inventory_part_1_view.niin_k08, dbo.inventory_part_1_view.e_code_mfg, dbo.inventory_part_1_view.prtnum_k71, dbo.inventory_part_1_view.pn_rev_k71, 
                         dbo.inventory_part_1_view.p_desc_k71, dbo.inventory_part_received_1_view.snq_11_k90, dbo.inventory_part_1_view.snq_21_k93, dbo.inventory_part_1_view.slq_21_k93, 
                         dbo.inventory_part_1_view.soq_21_k93, dbo.inventory_part_1_view.instat_k93, dbo.inventory_part_1_view.ictref_kbb, dbo.inventory_part_imported_1_view.e_code_imp, 
                         dbo.inventory_part_imported_1_view.e_name_imp, dbo.inventory_part_received_1_view.e_code_vnd, dbo.inventory_part_received_1_view.e_name_vnd, dbo.inventory_part_received_1_view.por_no_k89, 
                         dbo.inventory_part_received_1_view.cnt_no_k89, dbo.inventory_part_received_1_view.rcvdte_k98, dbo.inventory_part_imported_1_view.nni_no_k95, dbo.inventory_part_imported_1_view.effdte_k95, 
                         dbo.inventory_part_1_view.idnk93_k93, dbo.inventory_part_1_view.addtme_kbb, dbo.inventory_part_received_1_view.idnk92_k92, dbo.inventory_part_imported_1_view.idnk99_k99, 
                         dbo.inventory_part_received_1_view.idnk98_k98, dbo.inventory_part_imported_1_view.gduset_imp, dbo.inventory_part_1_view.locatn_kbc, dbo.inventory_part_1_view.d_code_whs, 
                         dbo.inventory_part_1_view.d_name_whs, dbo.inventory_part_1_view.idnk08_k08, dbo.inventory_part_1_view.invsta_k93, dbo.inventory_part_received_1_view.idnk89_k89, 
                         dbo.inventory_part_received_1_view.plr_no_k98, dbo.inventory_part_1_view.idnk71_k71, dbo.inventory_part_imported_1_view.idnk95_k95, dbo.inventory_part_received_1_view.idnk90_k90, 
                         dbo.inventory_part_1_view.p_um_k71, dbo.inventory_part_1_view.locqty_kbc, dbo.inventory_part_1_view.idnkbb_kbb, dbo.inventory_part_received_1_view.idnk12_vnd, 
                         dbo.inventory_part_imported_1_view.idnk12_imp, dbo.inventory_part_made_1_view.cntrct_k79, dbo.inventory_part_made_1_view.rel_no_k80, dbo.inventory_part_made_1_view.clinno_k81, 
                         dbo.inventory_part_made_1_view.job_no_ka8, dbo.inventory_part_made_1_view.jln_no_ka9, dbo.inventory_part_made_1_view.idnkab_kab, dbo.inventory_part_made_1_view.jlnsdt_ka9, 
                         dbo.inventory_part_made_1_view.idnka9_ka9, dbo.inventory_part_made_1_view.piidno_k80, dbo.inventory_part_imported_1_view.cnt_no_k99, dbo.inventory_part_imported_1_view.d_name_imp, 
                         dbo.inventory_part_imported_1_view.ictref_imp, dbo.inventory_part_imported_1_view.invsta_imp, dbo.inventory_part_imported_1_view.locatn_imp, dbo.inventory_part_imported_1_view.instat_imp
FROM            dbo.inventory_part_1_view LEFT OUTER JOIN
                         dbo.inventory_part_received_1_view ON dbo.inventory_part_1_view.idnk93_k93 = dbo.inventory_part_received_1_view.idnk93_k93 LEFT OUTER JOIN
                         dbo.inventory_part_imported_1_view ON dbo.inventory_part_1_view.idnk93_k93 = dbo.inventory_part_imported_1_view.idnk93_k93 LEFT OUTER JOIN
                         dbo.inventory_part_made_1_view ON dbo.inventory_part_1_view.idnk93_k93 = dbo.inventory_part_made_1_view.idnk93_k93








