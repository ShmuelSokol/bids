-- dbo.contract_mod_part_1_view



/* view contract_mod_part_1_view: add view */


/* view contract_mod_part_1_view: add view */


/* view contract_mod_part_1_view: add view */

/* view contract_mod_part_1_view: add view */


/* view contract_mod_part_1_view: add view */


/* view contract_mod_part_1_view: add view */


/* view contract_mod_part_1_view: add view */


/* view contract_mod_part_1_view: add view */


/* view contract_mod_part_1_view: add view */


/* view contract_mod_part_1_view: add view */
/* view contract_mod_part_1_view: add view 
 view contract_mod_part_1_view: add view 
 view contract_mod_part_1_view: add view 
 view contract_mod_part_1_view: add view 
 view contract_mod_part_1_view: add view 
 view contract_mod_part_1_view: add view 
 view contract_mod_part_1_view: add view 
 view contract_mod_part_1_view: add view */
CREATE VIEW [dbo].[contract_mod_part_1_view]
AS
SELECT        dbo.k08_tab.partno_k08 AS partno_prt, dbo.k08_tab.p_cage_k08 AS m_cage_prt, dbo.k08_tab.p_desc_k08 AS p_desc_prt, dbo.k08_tab.fsc_k08 AS fsc_prt, dbo.k08_tab.niin_k08 AS niin_prt, 
                         dbo.k08_tab.p_um_k08 AS p_um_prt, dbo.contract_mod_1_view.cntrct_k79, dbo.contract_mod_1_view.rel_no_k80, dbo.contract_mod_1_view.modnum_kd4, dbo.contract_mod_1_view.modate_kd4, 
                         dbo.contract_mod_1_view.modval_kd4, dbo.contract_mod_1_view.modtxt_kd4, dbo.contract_mod_1_view.mbstat_kd3, dbo.contract_mod_1_view.idnk79_k79, dbo.contract_mod_1_view.idnk80_k80, 
                         dbo.contract_mod_1_view.idnkd3_kd3, dbo.contract_mod_1_view.idnkd4_kd4, dbo.contract_mod_1_view.mgclas_kd6, dbo.contract_mod_1_view.msclas_kd6, dbo.contract_mod_1_view.mgr_no_kd6, 
                         dbo.contract_mod_1_view.mgrttl_kd6, dbo.contract_mod_1_view.idnkal_kd4, dbo.contract_mod_1_view.filnam_kal, dbo.contract_mod_1_view.cntrct_kd4, dbo.contract_mod_1_view.rel_no_kd4, 
                         dbo.contract_mod_1_view.modsrc_kd4, dbo.contract_mod_1_view.adtime_kd4, dbo.k08_tab.idnk08_k08, dbo.contract_mod_1_view.idnkal_kal, dbo.kd7_tab.idnkd7_kd7, dbo.contract_mod_1_view.idnkd6_kd6, 
                         dbo.contract_mod_1_view.piidno_kd4, dbo.contract_mod_1_view.piidno_k80
FROM            dbo.contract_mod_1_view LEFT OUTER JOIN
                         dbo.kd7_tab ON dbo.contract_mod_1_view.idnkd4_kd4 = dbo.kd7_tab.idnkd4_kd7 LEFT OUTER JOIN
                         dbo.k08_tab ON dbo.kd7_tab.idnk08_kd7 = dbo.k08_tab.idnk08_k08










