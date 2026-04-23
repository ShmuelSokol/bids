-- dbo.contract_mod_1_view



/* view contract_mod_1_view: add view */


/* view contract_mod_1_view: add view */


/* view contract_mod_1_view: add view */

/* view contract_mod_1_view: add view */


/* view contract_mod_1_view: add view */


/* view contract_mod_1_view: add view */


/* view contract_mod_1_view: add view */


/* view contract_mod_1_view: add view */


/* view contract_mod_1_view: add view */


/* view contract_mod_1_view: add view */
/* view contract_mod_1_view: add view 
 view contract_mod_1_view: add view 
 view contract_mod_1_view: add view 
 view contract_mod_1_view: add view 
 view contract_mod_1_view: add view 
 view contract_mod_1_view: add view 
 view contract_mod_1_view: add view 
 view contract_mod_1_view: add view */
CREATE VIEW [dbo].[contract_mod_1_view]
AS
SELECT        dbo.kd4_tab.cntrct_kd4, dbo.kd4_tab.rel_no_kd4, dbo.kd4_tab.adtime_kd4, dbo.contract_release_1_view.cntrct_k79, dbo.contract_release_1_view.rel_no_k80, dbo.kd4_tab.modnum_kd4, 
                         dbo.kd4_tab.modate_kd4, dbo.kd4_tab.modsrc_kd4, dbo.kd4_tab.modval_kd4, dbo.kd4_tab.modtxt_kd4, dbo.kd3_tab.mbstat_kd3, dbo.contract_release_1_view.idnk79_k79, 
                         dbo.contract_release_1_view.idnk80_k80, dbo.kd3_tab.idnkd3_kd3, dbo.kd4_tab.idnkd4_kd4, dbo.kd6_tab.mgclas_kd6, dbo.kd6_tab.msclas_kd6, dbo.kd6_tab.mgr_no_kd6, dbo.kd6_tab.mgrttl_kd6, 
                         dbo.kd4_tab.idnkal_kd4, dbo.kal_tab.filnam_kal, dbo.kal_tab.idnkal_kal, dbo.kd6_tab.idnkd6_kd6, dbo.kd4_tab.piidno_kd4, dbo.contract_release_1_view.piidno_k80
FROM            dbo.kd3_tab INNER JOIN
                         dbo.kd4_tab ON dbo.kd3_tab.idnkd3_kd3 = dbo.kd4_tab.idnkd3_kd4 LEFT OUTER JOIN
                         dbo.contract_release_1_view ON dbo.kd4_tab.idnk80_kd4 = dbo.contract_release_1_view.idnk80_k80 LEFT OUTER JOIN
                         dbo.kd6_tab ON dbo.kd4_tab.idnkd6_kd4 = dbo.kd6_tab.idnkd6_kd6 LEFT OUTER JOIN
                         dbo.kal_tab ON dbo.kd4_tab.idnkal_kd4 = dbo.kal_tab.idnkal_kal










