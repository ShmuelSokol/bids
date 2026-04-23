-- dbo.vendor_quote_5_view



/* view vendor_quote_5_view: add view */


/* view vendor_quote_5_view: add view */


/* view vendor_quote_5_view: add view */
CREATE VIEW dbo.vendor_quote_5_view
AS
SELECT DISTINCT 
                         dbo.vendor_quote_3_view.rfq_no_k42, dbo.vendor_quote_3_view.partno_k08, dbo.vendor_quote_3_view.p_cage_k08, dbo.vendor_quote_3_view.p_desc_k08, dbo.vendor_quote_3_view.fsc_k08, 
                         dbo.vendor_quote_3_view.niin_k08, dbo.vendor_quote_3_view.p_cage_k56, dbo.vendor_quote_3_view.partno_k56, dbo.vendor_quote_3_view.qotdte_k55, dbo.vendor_quote_3_view.p_um_k56, 
                         dbo.vendor_quote_3_view.su_lbs_k56, dbo.vendor_quote_3_view.s_code_k39, dbo.vendor_quote_3_view.e_name_k12, dbo.vendor_quote_3_view.idnk55_k55, dbo.vendor_quote_3_view.idnk56_k56, 
                         dbo.vendor_quote_3_view.p_note_k56, dbo.vendor_quote_3_view.qfactr_k56, dbo.vendor_quote_3_view.q_type_k56, dbo.vendor_quote_3_view.q_note_k55, dbo.vendor_quote_3_view.uptime_k56, 
                         dbo.vendor_quote_3_view.upname_k56, dbo.vendor_quote_3_view.idnk39_k39, dbo.vendor_quote_3_view.idnk08_k08, dbo.vendor_quote_3_view.idnk12_k12, dbo.vendor_quote_3_view.idnk42_k42, 
                         dbo.vendor_quote_3_view.idnk43_k43, dbo.vendor_quote_3_view.addtme_k42, dbo.vendor_quote_3_view.rfquno_k42, dbo.vendor_quote_3_view.rqpsta_k43, dbo.vendor_quote_3_view.rqptme_k43, K34_tab.uptime_k34, 
                         K34_tab.idnk34_k34, dbo.vendor_quote_3_view.rrqsta_k42, dbo.vendor_quote_3_view.itmcnt_k42, dbo.vendor_quote_3_view.uptime_k42, dbo.vendor_quote_3_view.qrefno_k55, dbo.k10_tab.sol_no_k10, 
                         dbo.k10_tab.closes_k10, dbo.vendor_quote_3_view.spncge_k40, dbo.vendor_quote_3_view.spnnum_k40, dbo.vendor_quote_3_view.idnk40_k40
FROM            dbo.vendor_quote_3_view LEFT OUTER JOIN
                         dbo.k45_tab ON dbo.vendor_quote_3_view.idnk43_k43 = dbo.k45_tab.idnk43_k45 LEFT OUTER JOIN
                         dbo.k37_tab AS K37_tab ON dbo.k45_tab.idnk37_k45 = K37_tab.idnk37_k37 LEFT OUTER JOIN
                         dbo.k11_tab AS K11_tab ON K11_tab.idnk11_k11 = K37_tab.idnvrq_k37 LEFT OUTER JOIN
                         dbo.k10_tab ON K11_tab.idnk10_k11 = dbo.k10_tab.idnk10_k10 LEFT OUTER JOIN
                         dbo.k34_tab AS K34_tab ON K34_tab.idnk11_k34 = K11_tab.idnk11_k11
WHERE        (K37_tab.vrqtyp_k37 = 'k11')



