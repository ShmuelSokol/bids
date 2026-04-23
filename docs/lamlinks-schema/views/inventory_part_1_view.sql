-- dbo.inventory_part_1_view



/* view inventory_part_1_view: add view */


/* view inventory_part_1_view: add view */


/* view inventory_part_1_view: add view */

/* view inventory_part_1_view: add view */


/* view inventory_part_1_view: add view */


/* view inventory_part_1_view: add view */


/* view inventory_part_1_view: add view */


/* view inventory_part_1_view: add view */
CREATE VIEW [dbo].[inventory_part_1_view]
AS
SELECT        dbo.part_2_view.fsc_k08, dbo.part_2_view.niin_k08, dbo.part_2_view.prtnum_k71, dbo.part_2_view.pn_rev_k71, dbo.part_2_view.p_desc_k71, dbo.part_2_view.e_code_mfg, dbo.part_2_view.e_name_mfg, 
                         dbo.k93_tab.instat_k93, dbo.k93_tab.insdte_k93, dbo.k93_tab.snq_21_k93, dbo.k93_tab.slq_21_k93, dbo.k93_tab.soq_21_k93, dbo.kbb_tab.ictref_kbb, dbo.kbb_tab.addtme_kbb, dbo.k93_tab.isttbl_k93, 
                         dbo.k93_tab.idnist_k93, dbo.kbc_tab.locatn_kbc, dbo.kbc_tab.locqty_kbc, dbo.ka7_tab.d_code_ka7 AS d_code_whs, dbo.ka7_tab.d_name_ka7 AS d_name_whs, dbo.part_2_view.idnk08_k08, 
                         dbo.part_2_view.idnk71_k71, dbo.k93_tab.idnk93_k93, dbo.ka7_tab.idnka7_ka7 AS idnka7_whs, dbo.kbb_tab.idnkbb_kbb, dbo.kbc_tab.idnkbc_kbc, dbo.k93_tab.invsta_k93, dbo.part_2_view.p_um_k71, 
                         dbo.kbc_tab.locmas_kbc
FROM            dbo.ka7_tab INNER JOIN
                         dbo.kbc_tab ON dbo.ka7_tab.idnka7_ka7 = dbo.kbc_tab.idnwhs_kbc RIGHT OUTER JOIN
                         dbo.part_2_view INNER JOIN
                         dbo.k93_tab ON dbo.part_2_view.idnk71_k71 = dbo.k93_tab.idnk71_k93 INNER JOIN
                         dbo.kbb_tab ON dbo.k93_tab.idnkbb_k93 = dbo.kbb_tab.idnkbb_kbb ON dbo.kbc_tab.idnk93_kbc = dbo.k93_tab.idnk93_k93








