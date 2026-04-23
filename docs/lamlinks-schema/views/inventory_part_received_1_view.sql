-- dbo.inventory_part_received_1_view



/* view inventory_part_received_1_view: add view */


/* view inventory_part_received_1_view: add view */


/* view inventory_part_received_1_view: add view */

/* view inventory_part_received_1_view: add view */


/* view inventory_part_received_1_view: add view */


/* view inventory_part_received_1_view: add view */


/* view inventory_part_received_1_view: add view */


/* view inventory_part_received_1_view: add view */


/* view inventory_part_received_1_view: add view */


/* view inventory_part_received_1_view: add view */


/* view inventory_part_received_1_view: add view */


/* view inventory_part_received_1_view: add view */


/* view inventory_part_received_1_view: add view */


/* view inventory_part_received_1_view: add view */


/* view inventory_part_received_1_view: add view */
/* view inventory_part_received_1_view: add view 
 view inventory_part_received_1_view: add view 
 view inventory_part_received_1_view: add view */
CREATE VIEW [dbo].[inventory_part_received_1_view]
AS
SELECT        dbo.k89_tab.por_no_k89, dbo.k89_tab.cnt_no_k89, dbo.k90_tab.snq_11_k90, dbo.inventory_part_1_view.fsc_k08, dbo.inventory_part_1_view.niin_k08, dbo.inventory_part_1_view.prtnum_k71, 
                         dbo.inventory_part_1_view.p_desc_k71, dbo.inventory_part_1_view.e_code_mfg, dbo.inventory_part_1_view.isttbl_k93, dbo.inventory_part_1_view.idnist_k93, dbo.k92_tab.rcvqty_k92, 
                         dbo.inventory_part_1_view.snq_21_k93, dbo.inventory_part_1_view.soq_21_k93, dbo.k98_tab.rcvdte_k98, dbo.inventory_part_1_view.idnk71_k71, dbo.k92_tab.idnk92_k92, 
                         dbo.inventory_part_1_view.idnk93_k93, dbo.k98_tab.idnk98_k98, dbo.k98_tab.idnwhs_k98, dbo.k98_tab.ffwder_k98, dbo.inventory_part_1_view.instat_k93, dbo.k98_tab.plr_no_k98, dbo.k98_tab.trakno_k98, 
                         dbo.k98_tab.boxcnt_k98, dbo.k98_tab.weight_k98, dbo.kbh_tab.pklqty_kbh, dbo.kbh_tab.rcvqty_kbh, dbo.inventory_part_1_view.locatn_kbc, dbo.supplier_1_view.s_code_k39 AS e_code_vnd, 
                         dbo.supplier_1_view.e_name_k12 AS e_name_vnd, dbo.supplier_1_view.idnk39_k39, dbo.kbh_tab.idnkbh_kbh, dbo.k89_tab.idnk89_k89, dbo.k90_tab.idnk90_k90, dbo.k91_tab.idnk91_k91, 
                         dbo.kbh_tab.crtsta_kbh, dbo.inventory_part_1_view.locqty_kbc, dbo.inventory_part_1_view.idnkbc_kbc, dbo.k89_tab.po_dte_k89, dbo.supplier_1_view.idnk12_k12 AS idnk12_vnd, 
                         dbo.k98_tab.idnkbj_k98 AS idnkbj_kbj, dbo.inventory_part_1_view.ictref_kbb
FROM            dbo.inventory_part_1_view INNER JOIN
                         dbo.k92_tab ON dbo.inventory_part_1_view.idnist_k93 = dbo.k92_tab.idnk92_k92 INNER JOIN
                         dbo.k91_tab ON dbo.k92_tab.idnk91_k92 = dbo.k91_tab.idnk91_k91 INNER JOIN
                         dbo.k90_tab ON dbo.k91_tab.idnk90_k91 = dbo.k90_tab.idnk90_k90 INNER JOIN
                         dbo.k89_tab ON dbo.k90_tab.idnk89_k90 = dbo.k89_tab.idnk89_k89 INNER JOIN
                         dbo.kbh_tab ON dbo.k92_tab.idnkbh_k92 = dbo.kbh_tab.idnkbh_kbh INNER JOIN
                         dbo.k98_tab ON dbo.kbh_tab.idnk98_kbh = dbo.k98_tab.idnk98_k98 INNER JOIN
                         dbo.supplier_1_view ON dbo.k89_tab.idnk39_k89 = dbo.supplier_1_view.idnk39_k39
WHERE        (dbo.inventory_part_1_view.isttbl_k93 = 'k92')















